import test from 'node:test'
import assert from 'node:assert/strict'
import { incomeSummary, reportYears, barbadosDay, monthRows, monthColumns, summaryLabels, otherCurrencyNote, DISCLAIMER } from '../lib/incomeSummary.js'

const quotes = [
  // Invoiced in Dec 2025, paid in Jan 2026: invoiced counts in 2025, received in 2026.
  { id: 'a', client_email: 'jane@example.com', total: 1000, invoice_number: 'INV-A', invoiced_at: '2025-12-20T14:00:00Z', amount_paid: 1000, paid_at: '2026-01-05T16:00:00Z' },
  // Invoiced Mar 2026, part-paid.
  { id: 'b', client_email: 'JANE@example.com', total: 2000, invoice_number: 'INV-B', invoiced_at: '2026-03-02T14:00:00Z', amount_paid: 500 },
  // Marked paid before payments existed (no payment rows).
  { id: 'c', client_name: 'Old Client', total: 300, invoice_number: 'INV-C', invoiced_at: '2026-04-01T14:00:00Z', paid_at: '2026-04-10T14:00:00Z', amount_paid: 0 },
  // A deposit job with billed costs: deposit Jun, balance Jul.
  { id: 'd', client_email: 'sam@example.com', total: 2000, invoice_number: 'INV-D', invoiced_at: '2026-06-01T14:00:00Z', is_deposit: true, invoice_amount: 1000,
    balance_invoice_number: 'INV-D2', balance_invoiced_at: '2026-07-01T14:00:00Z', billed_expenses_total: 450, amount_paid: 1000 },
  // A quote never invoiced: nothing.
  { id: 'e', client_email: 'x@example.com', total: 5000 },
]
const payments = [
  { quote_id: 'a', amount: 1000, received_on: '2026-01-05' },
  { quote_id: 'b', amount: 500, received_on: '2026-03-15' },
  { quote_id: 'd', amount: 1000, received_on: '2026-06-03' },
]
const expenses = [
  { amount: 200, incurred_on: '2026-03-01' },
  { amount: 250, incurred_on: '2026-06-02' },
  { amount: 99, incurred_on: '2025-11-30' },
]

test('Barbados days', () => {
  assert.equal(barbadosDay('2027-01-01T02:00:00Z'), '2026-12-31') // 10pm New Year's Eve in Barbados
  assert.equal(barbadosDay('2026-03-15'), '2026-03-15')
})

test('2026, professional: received is cash in the year; invoiced is by issue date', () => {
  const s = incomeSummary({ quotes, payments, expenses }, 2026)
  assert.equal(s.invoiced, 2000 + 300 + 1000 + 1450)   // B, C, D deposit, D balance (incl. billed costs)
  assert.equal(s.received, 1000 + 500 + 300 + 1000)    // A's Jan payment, B part, C legacy, D deposit
  assert.equal(s.outstanding, 1500 + 1450)             // B's rest, D's balance
  assert.equal(s.expenses, 450)
  assert.equal(s.net, 2800 - 450)
  assert.equal(s.invoiceCount, 4)
  assert.equal(s.parties, 3)                           // jane (either case), old client, sam
  assert.equal(s.average, Math.round((4750 / 4) * 100) / 100)
})

test('2025: the December invoice counts as invoiced, its January payment does not count as received', () => {
  const s = incomeSummary({ quotes, payments, expenses }, 2025)
  assert.equal(s.invoiced, 1000); assert.equal(s.received, 0); assert.equal(s.outstanding, 0); assert.equal(s.expenses, 99)
})

test('month by month', () => {
  const m = incomeSummary({ quotes, payments, expenses }, 2026).months
  assert.equal(m.length, 12)
  assert.deepEqual([m[0].received, m[2].invoiced, m[2].received, m[2].expenses], [1000, 2000, 500, 200])
  assert.deepEqual([m[5].invoiced, m[5].received, m[5].expenses, m[6].invoiced], [1000, 1000, 250, 1450])
  assert.deepEqual([m[3].invoiced, m[3].received], [300, 300])
  const rows = monthRows(incomeSummary({ quotes, payments, expenses }, 2026))
  assert.deepEqual(rows[2], { month: 'March 2026', invoiced: '2000.00', received: '500.00', expenses: '200.00' })
  assert.deepEqual(monthColumns('professional').map(c => c[0]), ['Month', 'Invoiced', 'Received', 'Expenses'])
})

test('an organisation sees what it paid, with no expenses or net, and counts professionals', () => {
  const orgQuotes = quotes.map(q => ({ ...q, freelancer_id: q.id === 'd' ? 'f2' : 'f1' }))
  const s = incomeSummary({ quotes: orgQuotes, payments, expenses }, 2026, 'organisation')
  assert.equal(s.expenses, 0); assert.equal(s.net, s.received); assert.equal(s.parties, 2)
  assert.deepEqual(monthColumns('organisation').map(c => c[0]), ['Month', 'Invoiced', 'Paid'])
  assert.equal(summaryLabels('organisation').headline, 'Total paid')
})

test('an empty year is all zeros, not errors', () => {
  const s = incomeSummary({}, 2026)
  assert.deepEqual([s.invoiced, s.received, s.outstanding, s.expenses, s.net, s.invoiceCount, s.parties, s.average], [0, 0, 0, 0, 0, 0, 0, 0])
})

test('years to choose from', () => {
  assert.deepEqual(reportYears({ quotes, payments, expenses }, 2026), ['2026', '2025'])
  assert.deepEqual(reportYears({}, 2026), ['2026'])
})

test('a job ticked paid, with payment rows that cover only part of it, is still received in full', () => {
  const legacy = { id: 'L', total: 1000, invoice_number: 'I', invoiced_at: '2026-01-05T14:00:00Z', paid_at: '2026-01-20T14:00:00Z', amount_paid: 10 }
  const s = incomeSummary({ quotes: [legacy], payments: [{ quote_id: 'L', amount: 10, received_on: '2026-02-01' }] }, 2026)
  assert.equal(s.received, 1000); assert.equal(s.outstanding, 0)
  assert.deepEqual([s.months[0].received, s.months[1].received], [990, 10])
})

test('another currency is left out and said so, not added in as Bds$', () => {
  const usd = { id: 'u', total: 100, currency: 'USD', invoice_number: 'U', invoiced_at: '2026-01-02T14:00:00Z', amount_paid: 100, paid_at: '2026-01-09T14:00:00Z' }
  const bds = { id: 'b', total: 100, currency: 'BBD', invoice_number: 'B', invoiced_at: '2026-01-02T14:00:00Z' }
  const s = incomeSummary({ quotes: [usd, bds], payments: [{ quote_id: 'u', amount: 100, received_on: '2026-01-09' }] }, 2026)
  assert.deepEqual([s.invoiced, s.received, s.invoiceCount, s.otherCurrency], [100, 0, 1, 1])
  assert.match(otherCurrencyNote(s), /^1 invoice in another currency is not included/)
  assert.equal(otherCurrencyNote(incomeSummary({ quotes: [bds] }, 2026)), '')
})

test('a mistyped date does not add year 9999 or year 0001 to the picker', () => {
  assert.deepEqual(reportYears({ payments: [{ quote_id: 'a', amount: 1, received_on: '9999-01-01' }, { quote_id: 'a', amount: 1, received_on: '0001-01-01' }] }, 2026), ['2026'])
})

test('the disclaimer, word for word, and no tax figures anywhere', () => {
  assert.equal(DISCLAIMER, 'This summary is generated from your Vetted.bb records only. It is not a tax return and does not constitute accounting advice. Check figures against your own records before filing.')
  const s = incomeSummary({ quotes, payments, expenses }, 2026)
  assert.equal(Object.keys(s).some(k => /tax|vat|bra/i.test(k)), false)
})
