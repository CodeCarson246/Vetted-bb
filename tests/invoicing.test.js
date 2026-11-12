import test from 'node:test'
import assert from 'node:assert/strict'
import {
  invoiceTermsFor, invoiceNumberFor, invoiceDueDate, fmtInvoiceDate, buildInvoicePatch,
  invoiceReplyBody, invoiceSummary, invoicePromptLink, invoicePromptQuoteId,
  awaitingInvoice, waitingSince, clearInvoicePrompt,
} from '../lib/invoicing.js'
import { quoteReplyKind } from '../lib/quoteReply.js'

const ID = '24d827f6-04f0-4ada-971a-cd680b0dfdfb'

test('an invoice carries the terms promised on the quote, or net 14', () => {
  assert.equal(invoiceTermsFor({ payment_terms: 'due_receipt' }), 'due_receipt')
  assert.equal(invoiceTermsFor({ payment_terms: 'net30' }), 'net30')
  assert.equal(invoiceTermsFor({ payment_terms: 'whenever' }), 'net14')
  assert.equal(invoiceTermsFor({}), 'net14')
  assert.equal(invoiceTermsFor(null), 'net14')
})

test('invoice numbers follow the INV-date-3 digits pattern', () => {
  assert.equal(invoiceNumberFor('2026-11-12', 0), 'INV-20261112-100')
  assert.equal(invoiceNumberFor('2026-11-12', 0.9999), 'INV-20261112-999')
  assert.match(invoiceNumberFor('2026-01-05'), /^INV-20260105-\d{3}$/)
})

test('the due date is the issue date plus the terms, across month and year ends', () => {
  assert.equal(invoiceDueDate('2026-11-12', 'due_receipt'), '2026-11-12')
  assert.equal(invoiceDueDate('2026-11-12', 'net7'), '2026-11-19')
  assert.equal(invoiceDueDate('2026-11-20', 'net14'), '2026-12-04')
  assert.equal(invoiceDueDate('2026-12-20', 'net14'), '2027-01-03')
  assert.equal(invoiceDueDate('2026-11-12', 'net30'), '2026-12-12')
})

test('dates read the same whatever timezone the server is in', () => {
  assert.equal(fmtInvoiceDate('2026-12-04'), '4 Dec 2026')
  assert.equal(fmtInvoiceDate('2027-01-01'), '1 Jan 2027')
  assert.equal(fmtInvoiceDate('not a date'), '')
})

test('the patch turns an accepted quote into an invoice and nothing else', () => {
  const patch = buildInvoicePatch({ issuedKey: '2026-11-12', nowIso: '2026-11-12T15:00:00.000Z', termsValue: 'net14', rand: 0.5 })
  assert.deepEqual(patch, {
    status: 'invoiced',
    invoice_number: 'INV-20261112-550',
    invoiced_at: '2026-11-12T15:00:00.000Z',
    invoice_terms: 'net14',
    invoice_due_date: '2026-11-26',
  })
})

test('the conversation line is one both pages recognise as an invoice', () => {
  const body = invoiceReplyBody('INV-20261112-550', '2026-11-26', 'net14')
  assert.equal(body, 'Sent invoice INV-20261112-550, payment due 26 Nov 2026 (net 14 days)')
  // The client page keys off "Sent invoice"; the professional's off quoteReplyKind.
  assert.ok(body.startsWith('Sent invoice'))
  assert.equal(quoteReplyKind({ body, quote_id: ID }), 'invoice')
  assert.equal(invoiceReplyBody('INV-1', '2026-11-12', 'due_receipt'), 'Sent invoice INV-1, payment due 12 Nov 2026 (due on receipt)')
})

test('the client summary states the amount and the due date', () => {
  assert.equal(invoiceSummary('INV-20261112-550', 756, '2026-11-26'), 'Invoice INV-20261112-550 for $756.00, payment due 26 Nov 2026')
  assert.equal(invoiceSummary('INV-1', '120.5', '2026-11-12'), 'Invoice INV-1 for $120.50, payment due 12 Nov 2026')
})

test('the send-invoice link round-trips, and nothing else is mistaken for one', () => {
  const link = invoicePromptLink(ID)
  assert.equal(link, `/quotes?invoice=${ID}`)
  assert.equal(invoicePromptQuoteId(link), ID)
  assert.equal(invoicePromptQuoteId('/quotes'), null)
  assert.equal(invoicePromptQuoteId('/quotes?invoice='), null)
  assert.equal(invoicePromptQuoteId('/quotes?invoice=<script>'), null)
  assert.equal(invoicePromptQuoteId('/inbox'), null)
  assert.equal(invoicePromptQuoteId(null), null)
})

test('waiting on you lists accepted quotes with no invoice, and only those', () => {
  const quotes = [
    { id: 1, status: 'accepted', invoice_number: null },
    { id: 2, status: 'accepted', invoice_number: 'INV-1' },
    { id: 3, status: 'invoiced', invoice_number: 'INV-2' },
    { id: 4, status: 'sent' },
    { id: 5, status: 'declined' },
    null,
  ]
  assert.deepEqual(awaitingInvoice(quotes).map(q => q.id), [1])
  assert.deepEqual(awaitingInvoice(null), [])
})

test('how long a client has been waiting', () => {
  const now = Date.parse('2026-11-12T18:00:00Z')
  assert.equal(waitingSince('2026-11-12T10:00:00Z', now), 'today')
  assert.equal(waitingSince('2026-11-11T12:00:00Z', now), 'yesterday')
  assert.equal(waitingSince('2026-11-09T12:00:00Z', now), '3 days ago')
  assert.equal(waitingSince(null, now), '')
  assert.equal(waitingSince('nonsense', now), '')
})

test('sending the invoice retires its notification, and never throws', async () => {
  const calls = []
  const supabase = {
    from: table => ({
      update: patch => ({ eq: async (col, val) => { calls.push({ table, patch, col, val }) } }),
    }),
  }
  await clearInvoicePrompt(supabase, ID)
  assert.deepEqual(calls, [{ table: 'notifications', patch: { read: true, link: '/quotes' }, col: 'link', val: `/quotes?invoice=${ID}` }])
  await clearInvoicePrompt(null, ID)
  await clearInvoicePrompt({ from: () => { throw new Error('offline') } }, ID)
})
