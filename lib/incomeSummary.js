// Year-end income summary: what was invoiced, what was received, what is still
// owed, and (for a professional) what was spent, for one calendar year.
// Pure: the Reports page, the CSV and the server-made PDF all call this, so
// the three can never disagree. Tested in tests/incomeSummary.test.js.
//
// RECEIVED is the headline: money counted on the day it came in, whichever
// year it was invoiced (cash basis). Invoiced is counted on the day each
// invoice was issued. Dates are Barbados days.
//
// Figures only. Nothing here works out tax, and nothing should.
import { invoicesOf, invoiceBalance, jobTotal } from './payments.js'

export const DISCLAIMER = 'This summary is generated from your Vetted.bb records only. It is not a tax return and does not constitute accounting advice. Check figures against your own records before filing.'
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const round2 = n => Math.round((Number(n) || 0) * 100) / 100

/** A Barbados day (YYYY-MM-DD) from a date or a timestamp. */
export function barbadosDay(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const t = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`)
  return Number.isFinite(t) ? new Date(t - 4 * 3600 * 1000).toISOString().slice(0, 10) : ''
}

// The summary is in Barbados dollars. A job in another currency is left out
// and counted, so it can be said plainly rather than added in as if it
// were Bds$.
const isBds = q => !q?.currency || q.currency === 'BBD'

/** Every invoice, payment and expense as a dated amount. */
export function ledger({ quotes = [], payments = [], expenses = [] }) {
  const invoices = []
  const receipts = []
  let otherCurrency = 0
  const left = new Set()
  const paidByQuote = {}
  for (const p of payments || []) paidByQuote[p.quote_id] = (paidByQuote[p.quote_id] || 0) + (Number(p.amount) || 0)
  for (const q of quotes || []) {
    const list = invoicesOf(q)
    if (!isBds(q)) { left.add(q.id); otherCurrency += list.length; continue }
    for (const inv of list) {
      invoices.push({ date: barbadosDay(inv.issued), amount: round2(inv.amount), quote: q, invoice: inv })
    }
    // A job marked paid is paid in full. Whatever its payment rows do not
    // cover (all of it, for a job ticked paid before part payments were
    // recorded) counts as received on the day it was marked paid.
    if (q.paid_at && list.length) {
      const shortfall = round2(jobTotal(q) - (paidByQuote[q.id] || 0))
      if (shortfall > 0) receipts.push({ date: barbadosDay(q.paid_at), amount: shortfall })
    }
  }
  for (const p of payments || []) {
    if (!left.has(p.quote_id)) receipts.push({ date: barbadosDay(p.received_on), amount: round2(p.amount) })
  }
  const spent = (expenses || []).map(e => ({ date: barbadosDay(e.incurred_on), amount: round2(e.amount) }))
  return { invoices, receipts, spent, otherCurrency }
}

/** The years there is anything to report on, newest first, always including `thisYear`. */
export function reportYears(data, thisYear) {
  const { invoices, receipts, spent } = ledger(data)
  const now = Number(thisYear)
  const years = new Set([String(thisYear)])
  for (const r of [...invoices, ...receipts, ...spent]) {
    const y = Number((r.date || '').slice(0, 4))
    // A mistyped date (year 9999, year 0001) does not get its own entry.
    if (y >= 2000 && y <= now + 1) years.add(String(y))
  }
  return [...years].sort().reverse()
}

/**
 * The summary for one year. `side` is 'professional' (money in, with
 * expenses and net) or 'organisation' (money out to professionals).
 */
export function incomeSummary(data, year, side = 'professional') {
  const y = String(year)
  const { invoices, receipts, spent, otherCurrency } = ledger(data)
  const inYear = r => r.date && r.date.slice(0, 4) === y

  const yearInvoices = invoices.filter(inYear)
  const invoiced = round2(yearInvoices.reduce((s, r) => s + r.amount, 0))
  const received = round2(receipts.filter(inYear).reduce((s, r) => s + r.amount, 0))
  const expenses = side === 'professional' ? round2(spent.filter(inYear).reduce((s, r) => s + r.amount, 0)) : 0
  // Still owed today on the invoices issued in this year.
  const outstanding = round2(yearInvoices.reduce((s, r) => s + invoiceBalance(r.quote, r.invoice).outstanding, 0))
  const parties = new Set(yearInvoices.map(r => side === 'organisation'
    ? (r.quote.freelancer_id || '')
    : String(r.quote.client_email || r.quote.client_name || '').trim().toLowerCase()).filter(Boolean))

  const months = MONTHS.map((name, i) => {
    const key = `${y}-${String(i + 1).padStart(2, '0')}`
    const sum = list => round2(list.filter(r => r.date.slice(0, 7) === key).reduce((s, r) => s + r.amount, 0))
    return { month: name, invoiced: sum(invoices), received: sum(receipts), expenses: side === 'professional' ? sum(spent) : 0 }
  })

  return {
    year: y,
    side,
    invoiced,
    received,
    outstanding,
    expenses,
    net: round2(received - expenses),
    invoiceCount: yearInvoices.length,
    parties: parties.size,
    average: yearInvoices.length ? round2(invoiced / yearInvoices.length) : 0,
    months,
    // Invoices in another currency, in any year: not in the figures above.
    otherCurrency,
  }
}

/** The line shown when invoices in another currency were left out ('' when none). */
export function otherCurrencyNote(summary) {
  const n = summary?.otherCurrency || 0
  return n > 0 ? `${n} invoice${n === 1 ? '' : 's'} in another currency ${n === 1 ? 'is' : 'are'} not included: this summary is in Barbados dollars only.` : ''
}

/** Plain-language labels, so the headline figure cannot be misread. */
export function summaryLabels(side) {
  return side === 'organisation'
    ? {
        title: 'SPENDING SUMMARY',
        headline: 'Total paid',
        headlineNote: 'Money paid to professionals in this year, counted on the day it was paid.',
        invoiced: 'Total invoiced to you',
        outstanding: 'Still to pay',
        parties: 'Professionals',
        received: 'Paid',
      }
    : {
        title: 'INCOME SUMMARY',
        headline: 'Total received',
        headlineNote: 'Money that reached you in this year, counted on the day it came in, whatever year it was invoiced.',
        invoiced: 'Total invoiced',
        outstanding: 'Outstanding',
        parties: 'Clients',
        received: 'Received',
      }
}

/** Rows for the CSV: one per month. No totals row (it breaks spreadsheets). */
export function monthColumns(side) {
  const l = summaryLabels(side)
  return side === 'organisation'
    ? [['Month', 'month'], ['Invoiced', 'invoiced'], [l.received, 'received']]
    : [['Month', 'month'], ['Invoiced', 'invoiced'], ['Received', 'received'], ['Expenses', 'expenses']]
}

export function monthRows(summary) {
  return summary.months.map(m => ({
    month: `${m.month} ${summary.year}`,
    invoiced: m.invoiced.toFixed(2),
    received: m.received.toFixed(2),
    expenses: m.expenses.toFixed(2),
  }))
}
