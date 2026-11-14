// Deposits, invoices and part payments: the money rules in one place, shared
// by the pages, the PDF and the server. Pure functions only (tested in
// tests/payments.test.js).
//
// How it is stored. An invoice is not its own table: it lives on the quote's
// row (see lib/invoicing.js). A job with a deposit carries TWO invoices on
// that same row, so it stays one job everywhere it is listed:
//
//   invoice_number / invoiced_at / invoice_due_date / invoice_terms
//       the first invoice: the deposit when is_deposit is true (its amount
//       is invoice_amount), otherwise the whole job (the quote's total)
//   balance_invoice_number / balance_invoiced_at / balance_invoice_due_date /
//   balance_invoice_terms
//       the second invoice, raised after the deposit is paid, for the rest
//
//   amount_paid   the running total of the rows in invoice_payments, kept
//                 by the database (SQL Section 44); never typed in
//   paid_at       set by the database once amount_paid reaches the total
//
// A job without a deposit works exactly as before.

// Anything that is not a real, finite number counts as 0.
const round2 = n => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0 }
export const money2 = n => round2(n).toFixed(2)

/**
 * What the job is invoiced for: the quote's total plus any expenses billed on
 * to the client (lib/expenses.js), which are copied onto the row when the
 * invoice that carries them is issued. Unbilled expenses are never part of it.
 */
export function jobTotal(q) {
  // Billed costs only ever add to a job (the database refuses a negative).
  return round2(round2(q?.total) + Math.max(0, round2(q?.billed_expenses_total)))
}

/** Quote-time deposit, in Bds$ (0 when none). Never more than the total. */
export function depositAmount(total, type, value) {
  const t = round2(total)
  const v = Number(value)
  if (!(t > 0) || !Number.isFinite(v) || v <= 0) return 0
  if (type === 'percent') return round2(t * Math.min(v, 100) / 100)
  if (type === 'fixed') return round2(Math.min(v, t))
  return 0
}

/** The deposit a saved quote asks for (0 when none, or when it is the whole total). */
export function quoteDeposit(q) {
  const d = depositAmount(q?.total, q?.deposit_type, q?.deposit_value)
  return d > 0 && d < round2(q?.total) ? d : 0
}

/** "Deposit required (50%)" / "Deposit required" for a fixed amount. */
export function depositLabel(q) {
  return q?.deposit_type === 'percent' ? `Deposit required (${Number(q.deposit_value)}%)` : 'Deposit required'
}

/**
 * The columns that make the first invoice a deposit invoice, when the quote
 * asks for one. Spread into the invoice patch; empty when there is no deposit,
 * so a quote without one is invoiced exactly as before.
 */
export function depositInvoiceColumns(q) {
  const d = quoteDeposit(q)
  return d > 0 ? { is_deposit: true, invoice_amount: d } : {}
}

/** Every invoice on a job, oldest first: { kind, number, issued, due, terms, amount }. */
export function invoicesOf(q) {
  if (!q?.invoice_number) return []
  const total = jobTotal(q)
  // A deposit is part of the job: never below nothing, never above all of it.
  const deposit = q.is_deposit ? Math.min(Math.max(0, round2(q.invoice_amount)), round2(q.total)) : 0
  const out = [{
    kind: q.is_deposit ? 'deposit' : 'full',
    number: q.invoice_number,
    issued: q.invoiced_at || null,
    due: q.invoice_due_date || null,
    terms: q.invoice_terms || null,
    amount: q.is_deposit ? deposit : total,
  }]
  if (q.is_deposit && q.balance_invoice_number) {
    out.push({
      kind: 'balance',
      number: q.balance_invoice_number,
      issued: q.balance_invoiced_at || null,
      due: q.balance_invoice_due_date || null,
      terms: q.balance_invoice_terms || null,
      amount: round2(total - deposit),
    })
  }
  return out
}

/** The invoice with this number, or the latest one. */
export function invoiceFor(q, number) {
  const list = invoicesOf(q)
  return (number && list.find(i => i.number === number)) || list[list.length - 1] || null
}

/** Money received against the job so far. */
export function amountPaid(q) {
  const paid = round2(q?.amount_paid)
  // A job marked paid is paid in full, whatever the payment rows add up to:
  // one ticked paid before part payments existed has no rows at all.
  if (q?.paid_at) return Math.max(paid, jobTotal(q))
  return paid
}

/** What is still owed on the whole job. */
export function jobOutstanding(q) {
  return Math.max(0, round2(jobTotal(q) - amountPaid(q)))
}

/**
 * Paid and still owed against ONE invoice. Payments are counted against the
 * deposit first, then the balance, which is the order they are asked for.
 */
export function invoiceBalance(q, invoice) {
  if (!invoice) return { paid: 0, outstanding: 0 }
  const received = amountPaid(q)
  const before = invoice.kind === 'balance' ? round2(q.invoice_amount) : 0
  const paid = Math.max(0, Math.min(invoice.amount, round2(received - before)))
  return { paid: round2(paid), outstanding: round2(invoice.amount - paid) }
}

/** 'paid' | 'part-paid' | 'unpaid' for one invoice. */
export function invoicePaymentStatus(q, invoice) {
  const { paid, outstanding } = invoiceBalance(q, invoice)
  if (invoice && outstanding <= 0) return 'paid'
  return paid > 0 ? 'part-paid' : 'unpaid'
}

/** 'paid' | 'part-paid' | 'unpaid' for the whole job. */
export function jobPaymentStatus(q) {
  if (q?.paid_at || jobOutstanding(q) <= 0) return 'paid'
  return amountPaid(q) > 0 ? 'part-paid' : 'unpaid'
}

/** A paid deposit with no balance invoice yet: the balance can be raised. */
export function canRaiseBalance(q) {
  if (!q?.is_deposit || !q.invoice_number || q.balance_invoice_number) return false
  const first = invoicesOf(q)[0]
  return invoiceBalance(q, first).outstanding <= 0 && jobOutstanding(q) > 0
}

/** The invoice a new payment most likely belongs to: the first one still owed. */
export function invoiceToPay(q) {
  const list = invoicesOf(q)
  return list.find(i => invoiceBalance(q, i).outstanding > 0) || list[list.length - 1] || null
}

export const PAYMENT_LABELS = { paid: 'Paid', 'part-paid': 'Part-paid', unpaid: 'Unpaid' }

/**
 * What is owed across a set of jobs, counted per invoice from what is still
 * outstanding on it (so part payments are taken off). A deposit job whose
 * balance has not been invoiced yet adds nothing until it is.
 * `today` is a Barbados day (YYYY-MM-DD); an invoice is overdue once its due
 * date is before it.
 * Returns { amount, invoices, overdue }.
 */
export function outstandingSummary(quotes, today) {
  let amount = 0, invoices = 0, overdue = 0
  for (const q of quotes || []) {
    if (!q?.invoice_number || q.paid_at) continue
    for (const inv of invoicesOf(q)) {
      const { outstanding } = invoiceBalance(q, inv)
      if (!(outstanding > 0)) continue
      amount += outstanding
      invoices++
      if (inv.due && today && String(inv.due).slice(0, 10) < today) overdue++
    }
  }
  return { amount: round2(amount), invoices, overdue }
}
