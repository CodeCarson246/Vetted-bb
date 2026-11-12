// What an invoice is, in one place: its number, its due date, the line it
// leaves in the conversation, and the link that takes a professional straight
// to sending one. Shared by the server (an invoice sent automatically when a
// quote is accepted) and the pages, so the two can never word it differently.
//
// An invoice is not its own row: it is the quote, with the invoice_* columns
// filled in and status 'invoiced'.
import { PAYMENT_TERMS, termDays, termLabel } from './paymentTerms.js'
import { addDays, isDateKey } from './rentals.js'

const DEFAULT_TERMS = 'net14'

/** The quote's own payment terms if they are ones we know, else net 14. */
export function invoiceTermsFor(quote) {
  return PAYMENT_TERMS.some(t => t.value === quote?.payment_terms) ? quote.payment_terms : DEFAULT_TERMS
}

export function invoiceNumberFor(dateKey, rand = Math.random()) {
  return `INV-${dateKey.replace(/-/g, '')}-${Math.floor(rand * 900) + 100}`
}

/** Due date (YYYY-MM-DD): the day it is issued plus the terms. */
export function invoiceDueDate(issuedKey, termsValue) {
  return addDays(issuedKey, termDays(termsValue))
}

/** "14 Dec 2026", from a YYYY-MM-DD key, the same on every machine. */
export function fmtInvoiceDate(key) {
  if (!isDateKey(key)) return ''
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** The columns that turn an accepted quote into an invoice. */
export function buildInvoicePatch({ issuedKey, nowIso, termsValue, rand }) {
  return {
    status: 'invoiced',
    invoice_number: invoiceNumberFor(issuedKey, rand),
    invoiced_at: nowIso,
    invoice_terms: termsValue,
    invoice_due_date: invoiceDueDate(issuedKey, termsValue),
  }
}

// The reply that shows the invoice card in the conversation. Both sides'
// pages recognise an invoice by the words "Sent invoice", so keep them.
export function invoiceReplyBody(invoiceNumber, dueKey, termsValue) {
  return `Sent invoice ${invoiceNumber}, payment due ${fmtInvoiceDate(dueKey)} (${termLabel(termsValue).toLowerCase()})`
}

/** The one-line summary used in the client's notification and email. */
export function invoiceSummary(invoiceNumber, total, dueKey) {
  return `Invoice ${invoiceNumber} for $${Number(total || 0).toFixed(2)}, payment due ${fmtInvoiceDate(dueKey)}`
}

// A notification that an accepted quote still needs its invoice links here.
// The Quotes page opens a short confirmation for that quote, so sending it is
// two taps from the bell, a push notification or the email.
const PROMPT_PATH = '/quotes?invoice='

export function invoicePromptLink(quoteId) {
  return `${PROMPT_PATH}${quoteId}`
}

export function invoicePromptQuoteId(link) {
  if (typeof link !== 'string' || !link.startsWith(PROMPT_PATH)) return null
  const id = link.slice(PROMPT_PATH.length).split('&')[0]
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null
}

/** Accepted, and nothing sent yet: the professional's move. */
export function awaitingInvoice(quotes) {
  return (quotes || []).filter(q => q && q.status === 'accepted' && !q.invoice_number)
}

/** "today", "yesterday", "3 days ago": how long a client has been waiting. */
export function waitingSince(iso, now = Date.now()) {
  const t = iso ? new Date(iso).getTime() : NaN
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((now - t) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

// Once the invoice has gone, the "send the invoice" notifications for that
// quote have nothing left to offer: mark them read and point them at the
// quotes list. Row-level security limits this to the caller's own rows.
export async function clearInvoicePrompt(supabase, quoteId) {
  if (!supabase || !quoteId) return
  try {
    await supabase.from('notifications').update({ read: true, link: '/quotes' }).eq('link', invoicePromptLink(quoteId))
  } catch { /* the notification is a convenience; the invoice is already sent */ }
}
