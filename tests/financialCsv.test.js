import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateKey, todayKey, freelancerRecords, organisationRecords, selectRecords, buildCsv, csvCell,
  exportFilename, presetRange, FREELANCER_COLUMNS, ORGANISATION_COLUMNS,
} from '../lib/financialCsv.js'

const TODAY = '2026-11-13'
const sent = { id: 'q1', quote_number: 'QT-20261101-101', quote_date: '2026-11-01', created_at: '2026-11-01T14:00:00+00:00', status: 'sent', total: 1250, client_name: 'Dana Clarke', client_email: 'dana@example.com', items: [{ description: 'Tap repair', qty: '1', price: '1250' }] }
const paidJob = { id: 'q2', quote_number: 'QT-20261002-202', quote_date: '2026-10-02', status: 'paid', total: '225.5', client_name: 'Sam, "the builder"', client_email: 's@example.com', items: [], invoice_number: 'INV-20261005-303', invoiced_at: '2026-10-05T15:00:00+00:00', invoice_due_date: '2026-10-19', paid_at: '2026-10-20T01:30:00+00:00' }
const lateJob = { id: 'q3', quote_number: 'QT-20261001-404', quote_date: '2026-10-01', status: 'invoiced', total: 600, client_name: '=HYPERLINK("http://evil.example")', client_email: '', items: [{ description: '' }, { description: 'Fence, 20 ft' }], invoice_number: 'INV-20261003-505', invoiced_at: '2026-10-03T12:00:00+00:00', invoice_due_date: '2026-10-17', paid_at: null }
const declined = { id: 'q4', quote_number: 'QT-20250501-606', quote_date: '2025-05-01', status: 'declined', total: 80, client_name: 'Old client', items: [] }

const recs = freelancerRecords([sent, paidJob, lateJob, declined], { today: TODAY })
const find = (type, number) => recs.find(r => r.type === type && r.number === number)

test('dates are Barbados days as YYYY-MM-DD', () => {
  assert.equal(dateKey('2026-10-20T01:30:00+00:00'), '2026-10-19') // 9:30pm on the 19th in Barbados
  assert.equal(dateKey('2026-10-19'), '2026-10-19')
  assert.equal(dateKey('2026-11-01T14:00:00'), '2026-11-01')
  assert.equal(dateKey(null), '')
  assert.equal(todayKey(Date.parse('2026-11-14T02:00:00Z')), '2026-11-13')
})

test('a quote that became an invoice is two lines, linked by the quote number', () => {
  assert.equal(recs.length, 6)
  const q = find('Quote', 'QT-20261002-202'), inv = find('Invoice', 'INV-20261005-303')
  assert.equal(q.status, 'accepted'); assert.equal(q.linkedQuote, ''); assert.equal(q.due, '')
  assert.equal(inv.linkedQuote, 'QT-20261002-202')
  assert.equal(inv.issued, '2026-10-05'); assert.equal(inv.due, '2026-10-19'); assert.equal(inv.paid, '2026-10-19')
  assert.equal(inv.status, 'paid'); assert.equal(inv.daysOverdue, '')
})

test('statuses come from what is saved', () => {
  assert.equal(find('Quote', 'QT-20261101-101').status, 'sent')
  assert.equal(find('Quote', 'QT-20250501-606').status, 'declined')
  const late = find('Invoice', 'INV-20261003-505')
  assert.equal(late.status, 'overdue'); assert.equal(late.daysOverdue, '27')
})

test('no VAT is invented: VAT blank, net and gross are the amount charged', () => {
  for (const r of recs) { assert.equal(r.vat, ''); assert.equal(r.net, r.gross) }
  assert.equal(find('Invoice', 'INV-20261005-303').gross, '225.50')
  assert.equal(find('Quote', 'QT-20261101-101').net, '1250.00')
})

test('description is the first line item that has one', () => {
  assert.equal(find('Quote', 'QT-20261001-404').description, 'Fence, 20 ft')
  assert.equal(find('Quote', 'QT-20250501-606').description, '')
})

test('date range, type and newest first', () => {
  const all = selectRecords(recs, { from: '2026-01-01', to: TODAY })
  assert.deepEqual(all.map(r => r.number), ['QT-20261101-101', 'INV-20261005-303', 'INV-20261003-505', 'QT-20261002-202', 'QT-20261001-404'])
  assert.deepEqual(selectRecords(recs, { from: '2026-01-01', to: TODAY, type: 'invoices' }).map(r => r.type), ['Invoice', 'Invoice'])
  assert.deepEqual(selectRecords(recs, { from: '2026-01-01', to: TODAY, type: 'quotes' }).map(r => r.type), ['Quote', 'Quote', 'Quote'])
  assert.equal(selectRecords(recs, { from: '2026-10-05', to: '2026-10-05' }).length, 1) // both ends inclusive
  assert.equal(selectRecords(recs, { from: '2027-01-01', to: '2027-12-31' }).length, 0)
  assert.equal(selectRecords(recs, {}).length, 6)
})

test('the file: BOM, header in order, escaping, no totals row', () => {
  const csv = buildCsv(selectRecords(recs, { from: '2026-10-01', to: '2026-10-31', type: 'invoices' }), FREELANCER_COLUMNS)
  assert.equal(csv.charCodeAt(0), 0xFEFF)
  const lines = csv.slice(1).trimEnd().split('\r\n')
  assert.equal(lines[0], 'Document type,Document number,Date issued,Date due,Date paid,Client name,Client email,Description,Amount net,VAT,Amount gross,Status,Days overdue,Payment method,Payment reference,Linked quote number')
  assert.equal(lines.length, 3) // header + two invoices, nothing else
  assert.equal(lines[1], 'Invoice,INV-20261005-303,2026-10-05,2026-10-19,2026-10-19,"Sam, ""the builder""",s@example.com,,225.50,,225.50,paid,,,,QT-20261002-202')
  assert.match(lines[2], /^Invoice,INV-20261003-505,.*,"'=HYPERLINK\(""http:\/\/evil\.example""\)",/)
  assert.doesNotMatch(csv, /total/i)
})

test('csvCell quotes only when needed', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell('-5', { text: true }), "'-5")
  assert.equal(csvCell('-5'), '-5')
  // Any cell that is not a plain number is guarded, listed as text or not.
  assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`)
  assert.equal(csvCell('+1+1'), "'+1+1")
  assert.equal(csvCell('@SUM(1)'), "'@SUM(1)")
  assert.equal(csvCell('-2+3'), "'-2+3")
  assert.equal(csvCell('-12.50'), '-12.50')
  assert.equal(csvCell(-12.5), '-12.5')
})

test('organisation export: the professional, who raised it, the PO number', () => {
  const q = { ...paidJob, freelancer_id: 'f1', message_id: 'm1', reference: 'PO-7781', freelancers: { name: 'Carson Pitts', company_name: 'Think Sports' } }
  const org = organisationRecords([q], { today: TODAY, contacts: new Map([['f1', { email: 'pro@example.com' }]]), raisedBy: { m1: 'Olive Owner' } })
  const csv = buildCsv(selectRecords(org), ORGANISATION_COLUMNS).slice(1).trimEnd().split('\r\n')
  assert.equal(csv[0], 'Document type,Document number,Date issued,Date due,Date paid,Professional name,Professional email,Description,Raised by,PO number,Amount net,VAT,Amount gross,Status,Days overdue,Payment method,Payment reference,Linked quote number')
  assert.equal(csv[1], 'Invoice,INV-20261005-303,2026-10-05,2026-10-19,2026-10-19,Think Sports,pro@example.com,,Olive Owner,PO-7781,225.50,,225.50,paid,,,,QT-20261002-202')
  const noCompany = organisationRecords([{ ...q, freelancers: { name: 'Carson Pitts', company_name: 'TS' } }], { today: TODAY })
  assert.equal(noCompany[0].partyName, 'Carson Pitts'); assert.equal(noCompany[0].partyEmail, '')
})

test('filename and presets', () => {
  assert.equal(exportFilename('2026-01-01', '2026-11-13'), 'vetted-invoices-2026-01-01-to-2026-11-13.csv')
  assert.deepEqual(presetRange('thisYear', { today: TODAY }), { from: '2026-01-01', to: TODAY })
  assert.deepEqual(presetRange('lastYear', { today: TODAY }), { from: '2025-01-01', to: '2025-12-31' })
  assert.deepEqual(presetRange('last90', { today: TODAY }), { from: '2026-08-16', to: TODAY })
  assert.deepEqual(presetRange('allTime', { today: TODAY, earliest: '2025-05-01' }), { from: '2025-05-01', to: TODAY })
  assert.deepEqual(presetRange('allTime', { today: TODAY }), { from: TODAY, to: TODAY })
})

test('a deposit job: deposit and balance invoices are separate lines with their own amounts and payments', () => {
  const job = {
    id: 'q9', quote_number: 'QT-20261101-909', quote_date: '2026-11-01', status: 'invoiced', total: 2000, client_name: 'Dana', items: [],
    deposit_type: 'percent', deposit_value: 50, is_deposit: true, invoice_amount: 1000, amount_paid: 1250,
    invoice_number: 'INV-D', invoiced_at: '2026-11-02T12:00:00Z', invoice_due_date: '2026-11-09',
    balance_invoice_number: 'INV-B', balance_invoiced_at: '2026-11-05T12:00:00Z', balance_invoice_due_date: '2026-11-19',
  }
  const payments = { q9: [
    { invoice_number: 'INV-D', amount: 1000, received_on: '2026-11-04', method: 'Cash', reference: '' },
    { invoice_number: 'INV-B', amount: 250, received_on: '2026-11-10', method: 'Bank transfer', reference: 'TX-77' },
  ] }
  const rows = freelancerRecords([job], { today: '2026-11-13', payments })
  const d = rows.find(r => r.number === 'INV-D'), b = rows.find(r => r.number === 'INV-B')
  assert.deepEqual([d.gross, d.status, d.paid, d.paymentMethod, d.linkedQuote], ['1000.00', 'paid', '2026-11-04', 'Cash', 'QT-20261101-909'])
  assert.deepEqual([b.gross, b.status, b.paid, b.paymentMethod, b.paymentReference], ['1000.00', 'part-paid', '', 'Bank transfer', 'TX-77'])
  assert.equal(rows.find(r => r.type === 'Quote').gross, '2000.00')
})
