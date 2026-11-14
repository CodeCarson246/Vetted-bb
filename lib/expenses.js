// Job expenses: what a job cost the professional, and the part of it billed
// on to the client. Pure (tested in tests/expenses.test.js).
//
// PRIVATE BY DESIGN. Expenses live in job_expenses, which only their
// professional can read (SQL Section 47). The ONLY way an expense reaches a
// client is billedSnapshot(): when an invoice is issued, the expenses ticked
// "Bill to client" are copied onto the quote's row as cost lines. Every
// client-facing page, PDF and email reads the quote's row, never
// job_expenses, so an unbilled expense cannot appear in any of them.
import { jobTotal } from './payments.js'

const round2 = n => Math.round((Number(n) || 0) * 100) / 100

/**
 * Can a "Bill to client" expense still go on an invoice for this job? Yes
 * until the invoice that carries costs is issued: the job's invoice, or for
 * a deposit job its balance invoice (the deposit is a share of the quote).
 * Issued invoices are never changed.
 */
export function canStillBill(q) {
  if (!q) return false
  if (!q.invoice_number) return true
  return !!q.is_deposit && !q.balance_invoice_number
}

/**
 * Does the invoice about to be issued carry the billed costs? The first
 * invoice does, unless it is a deposit invoice; a balance invoice always does.
 */
export function invoiceCarriesCosts({ kind }) {
  return kind === 'full' || kind === 'balance'
}

/**
 * The columns that copy billed expenses onto the job when an invoice is
 * issued, plus the ids to mark as billed. Only expenses ticked "Bill to
 * client" and not already on an earlier invoice are taken.
 */
export function billedSnapshot(expenses) {
  const lines = (expenses || [])
    .filter(e => e && e.bill_to_client && !e.billed_invoice_number && Number(e.amount) > 0)
    .sort((a, b) => String(a.incurred_on).localeCompare(String(b.incurred_on)))
  if (lines.length === 0) return { columns: {}, ids: [] }
  return {
    columns: {
      billed_expenses: lines.map(e => ({ description: String(e.description).trim().slice(0, 200), amount: round2(e.amount), incurred_on: e.incurred_on })),
      billed_expenses_total: round2(lines.reduce((s, e) => s + Number(e.amount), 0)),
    },
    ids: lines.map(e => e.id),
  }
}

/** The total billed expenses would add to the next invoice (for previews). */
export function pendingBilledTotal(expenses) {
  return round2((expenses || []).filter(e => e?.bill_to_client && !e.billed_invoice_number).reduce((s, e) => s + Number(e.amount || 0), 0))
}

/**
 * The professional's private summary for a job: what was invoiced (or, before
 * an invoice, quoted), what it cost, and the difference.
 */
export function jobProfit(q, expenses) {
  const invoiced = q?.invoice_number ? jobTotal(q) : round2(q?.total)
  const spent = round2((expenses || []).reduce((s, e) => s + Number(e?.amount || 0), 0))
  return { invoiced, expenses: spent, profit: round2(invoiced - spent), invoicedYet: !!q?.invoice_number }
}

/** Rows for the expenses CSV (a second file, next to the invoices one). */
export const EXPENSE_COLUMNS = [
  ['Date', 'date'], ['Description', 'description'], ['Amount', 'amount'], ['Billed to client', 'billed'],
  ['On invoice', 'invoice'], ['Job (quote number)', 'job'], ['Client', 'client'], ['Receipt', 'receipt'],
  ['Job invoiced', 'jobInvoiced'], ['Job expenses', 'jobExpenses'], ['Job profit', 'jobProfit'],
]

export function expenseRecords(expenses, quotesById = {}) {
  const byJob = {}
  for (const e of expenses || []) (byJob[e.quote_id || ''] = byJob[e.quote_id || ''] || []).push(e)
  return (expenses || []).map(e => {
    const q = e.quote_id ? quotesById[e.quote_id] : null
    const p = q ? jobProfit(q, byJob[e.quote_id]) : null
    return {
      issued: String(e.incurred_on || '').slice(0, 10),
      date: String(e.incurred_on || '').slice(0, 10),
      description: e.description || '',
      amount: round2(e.amount).toFixed(2),
      billed: e.bill_to_client ? 'Yes' : 'No',
      invoice: e.billed_invoice_number || '',
      job: q?.quote_number || '',
      client: q?.client_name || '',
      receipt: e.receipt_url ? 'Yes' : 'No',
      jobInvoiced: p ? p.invoiced.toFixed(2) : '',
      jobExpenses: p ? p.expenses.toFixed(2) : '',
      jobProfit: p ? p.profit.toFixed(2) : '',
    }
  })
}
