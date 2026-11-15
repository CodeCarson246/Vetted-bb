import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canStillBill, invoiceCarriesCosts, billedSnapshot, pendingBilledTotal, jobProfit, expenseRecords, EXPENSE_COLUMNS } from '../lib/expenses.js'
import { invoicesOf, jobOutstanding } from '../lib/payments.js'
import { buildDocumentHtml } from '../lib/documentHtml.js'

const pipe = { id: 'e1', description: 'Copper pipe', amount: 300, incurred_on: '2026-11-10', bill_to_client: true }
const fittings = { id: 'e2', description: 'Fittings', amount: 150, incurred_on: '2026-11-11', bill_to_client: true }
const fuel = { id: 'e3', description: 'Fuel (internal)', amount: 40, incurred_on: '2026-11-11', bill_to_client: false }

test('only ticked, not-yet-billed expenses are copied onto an invoice', () => {
  const { columns, ids } = billedSnapshot([fuel, fittings, pipe, { ...pipe, id: 'e9', billed_invoice_number: 'INV-OLD' }])
  assert.deepEqual(ids, ['e1', 'e2'])
  assert.equal(columns.billed_expenses_total, 450)
  assert.deepEqual(columns.billed_expenses.map(l => l.description), ['Copper pipe', 'Fittings'])
  assert.equal(JSON.stringify(columns).includes('Fuel'), false)
  assert.deepEqual(billedSnapshot([fuel]), { columns: {}, ids: [] })
  assert.equal(pendingBilledTotal([pipe, fittings, fuel]), 450)
})

test('when billing is still possible', () => {
  assert.equal(canStillBill({}), true)
  assert.equal(canStillBill({ invoice_number: 'INV-1' }), false)
  assert.equal(canStillBill({ invoice_number: 'INV-D', is_deposit: true }), true)
  assert.equal(canStillBill({ invoice_number: 'INV-D', is_deposit: true, balance_invoice_number: 'INV-B' }), false)
  assert.equal(invoiceCarriesCosts({ kind: 'full' }), true)
  assert.equal(invoiceCarriesCosts({ kind: 'deposit' }), false)
  assert.equal(invoiceCarriesCosts({ kind: 'balance' }), true)
})

test('billed costs raise the invoice; unbilled ones never do', () => {
  const q = { total: 2000, invoice_number: 'INV-1', billed_expenses_total: 450, amount_paid: 0 }
  assert.equal(invoicesOf(q)[0].amount, 2450)
  assert.equal(jobOutstanding(q), 2450)
  const dep = { total: 2000, invoice_number: 'INV-D', is_deposit: true, invoice_amount: 1000, amount_paid: 1000, balance_invoice_number: 'INV-B', billed_expenses_total: 450 }
  assert.deepEqual(invoicesOf(dep).map(i => [i.kind, i.amount]), [['deposit', 1000], ['balance', 1450]])
})

test('the profit summary', () => {
  assert.deepEqual(jobProfit({ total: 2000, invoice_number: 'INV-1', billed_expenses_total: 450 }, [pipe, fittings, fuel]),
    { invoiced: 2450, expenses: 490, profit: 1960, invoicedYet: true, toBill: 0 })
  assert.deepEqual(jobProfit({ total: 2000 }, [fuel]), { invoiced: 2000, expenses: 40, profit: 1960, invoicedYet: false, toBill: 0 })
})

test('a cost to be billed on does not lower the profit, before or after the invoice', () => {
  // Before the invoice: Bds$10 billed on, Bds$10 kept internal, on a Bds$150 quote.
  const billed = { amount: 10, bill_to_client: true }, internal = { amount: 10, bill_to_client: false }
  const before = jobProfit({ total: 150, status: 'sent' }, [billed, internal])
  assert.deepEqual([before.invoiced, before.expenses, before.profit, before.toBill], [160, 20, 140, 10])
  // After the invoice that carries it: counted once, in the invoiced total.
  const after = jobProfit({ total: 150, invoice_number: 'INV-1', billed_expenses_total: 10 }, [{ ...billed, billed_invoice_number: 'INV-1' }, internal])
  assert.deepEqual([after.invoiced, after.profit, after.toBill], [160, 140, 0])
  // A deposit job before its balance invoice: the cost will go on the balance.
  const dep = jobProfit({ total: 150, invoice_number: 'D', is_deposit: true, invoice_amount: 75 }, [billed])
  assert.deepEqual([dep.invoiced, dep.profit], [160, 150])
})

const job = {
  quote_number: 'QT-1', quote_date: '2026-11-01', total: 2000, currency: 'BBD', verify_code: 'ABCD1234',
  items: [{ description: 'Rewire kitchen', qty: '1', price: '2000' }],
  invoice_number: 'INV-1', invoiced_at: '2026-11-12T12:00:00Z', invoice_due_date: '2026-11-26',
  billed_expenses: [{ description: 'Copper pipe', amount: 300, incurred_on: '2026-11-10' }, { description: 'Fittings', amount: 150, incurred_on: '2026-11-11' }],
  billed_expenses_total: 450,
}
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ')

test('the invoice PDF shows billed costs as cost lines and totals them in', () => {
  const t = text(buildDocumentHtml(job, {}, { type: 'invoice' }))
  assert.match(t, /Cost: Copper pipe/); assert.match(t, /Cost: Fittings/)
  assert.match(t, /Total Bds\$2450\.00/)
})

test('the QUOTE PDF never shows costs, even ones billed later', () => {
  const t = text(buildDocumentHtml(job, {}, { type: 'quote' }))
  assert.doesNotMatch(t, /Copper pipe|Fittings|Cost:/)
  assert.match(t, /Total Bds\$2000\.00/)
})

test('a deposit invoice does not carry costs; the balance invoice does', () => {
  const dep = { ...job, is_deposit: true, invoice_amount: 1000, deposit_type: 'percent', deposit_value: 50, amount_paid: 1000, balance_invoice_number: 'INV-B' }
  assert.doesNotMatch(text(buildDocumentHtml(dep, {}, { type: 'invoice', invoiceNumber: 'INV-1' })), /Cost:/)
  assert.match(text(buildDocumentHtml(dep, {}, { type: 'invoice', invoiceNumber: 'INV-B' })), /Cost: Copper pipe/)
})

test('the expenses export file', () => {
  const rows = expenseRecords([pipe, fuel], { undefined: null })
  assert.equal(rows[1].billed, 'No'); assert.equal(rows[0].amount, '300.00')
  const withJob = expenseRecords([{ ...pipe, quote_id: 'q1', billed_invoice_number: 'INV-1' }, { ...fuel, quote_id: 'q1' }], { q1: job })
  assert.deepEqual([withJob[0].job, withJob[0].invoice, withJob[0].jobInvoiced, withJob[0].jobExpenses, withJob[0].jobProfit], ['QT-1', 'INV-1', '2450.00', '340.00', '2110.00'])
})

test('the expenses file: a client or job name that is a spreadsheet formula stays text', async () => {
  const { buildCsv } = await import('../lib/financialCsv.js')
  const evil = '=HYPERLINK("http://evil.example","x")'
  const rows = expenseRecords(
    [{ quote_id: 'q1', description: evil, amount: 5, incurred_on: '2026-01-03', billed_invoice_number: evil, bill_to_client: true }],
    { q1: { id: 'q1', quote_number: evil, client_name: evil, total: 100 } },
  )
  const cells = buildCsv(rows, EXPENSE_COLUMNS).split('\r\n')[1]
  assert.equal(/(^|,)"?=/.test(cells), false)
  assert.equal((cells.match(/'=HYPERLINK/g) || []).length, 4)   // description, invoice, job, client
})

// The guarantee in code: nothing a client can open reads job_expenses. Only
// the professional's own pages and the server's invoice code may.
test('no client-facing file reads job_expenses', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const ALLOWED = new Set([
    'app/quotes/page.js',          // the professional's Quotes & earnings
    'app/inbox/page.js',           // the professional's inbox (issuing an invoice)
    'components/ExpensesPanel.js', // the professional's expenses section
    'lib/serverInvoice.js',        // the automatic invoice (server, service role)
    'app/reports/page.js',         // the professional's own year-end summary (amounts and dates only)
    'app/api/documents/pdf/route.js', // that summary's PDF, read with the professional's own session
  ])
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out); else if (name.endsWith('.js')) out.push(p)
    }
    return out
  }
  const readers = ['app', 'components', 'lib'].flatMap(d => walk(path.join(root, d)))
    .map(p => path.relative(root, p).split(path.sep).join('/'))
    .filter(rel => /job_expenses/.test(readFileSync(path.join(root, rel), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')))
  assert.deepEqual(readers.filter(r => !ALLOWED.has(r)), [])
})
