import { buildInvoicePatch, invoiceReplyBody, invoiceSummary, invoiceTermsFor } from '@/lib/invoicing'
import { invoicesOf } from '@/lib/payments'
import { billedSnapshot, invoiceCarriesCosts } from '@/lib/expenses'
import { todayKeyBarbados } from '@/lib/rentals'
import { notifyThreadClient } from '@/lib/serverThreadNotify'

// Server-only. Sends the invoice for a quote the client has just accepted,
// when the professional asked for that on the quote ("send the invoice
// automatically when this is accepted").
//
// It is the professional's own invoice, exactly as if they had pressed Send
// invoice themselves: their quote, the payment terms they put on it, their
// name on the line in the conversation. Vetted issues nothing of its own.
//
// Returns { invoice_number, invoice_due_date }, or null when there was
// nothing to do (already invoiced, no longer accepted).
export async function issueInvoiceOnAcceptance(admin, quote, freelancer) {
  if (!quote?.id || quote.invoice_number) return null

  const termsValue = invoiceTermsFor(quote)
  // A quote that asks for a deposit is invoiced for the deposit first.
  const patch = buildInvoicePatch({
    issuedKey: todayKeyBarbados(),
    nowIso: new Date().toISOString(),
    termsValue,
    quote,
  })
  // Expenses the professional chose to bill on go on this invoice as cost
  // lines, unless it is a deposit invoice (they go on the balance). Read with
  // the service role; before SQL Section 47 there are none.
  let billedIds = []
  if (invoiceCarriesCosts(invoicesOf({ ...quote, ...patch })[0] || {})) {
    const { data: exp, error: expErr } = await admin.from('job_expenses').select('*').eq('quote_id', quote.id)
    if (!expErr) {
      const snap = billedSnapshot(exp || [])
      Object.assign(patch, snap.columns)
      billedIds = snap.ids
    }
  }
  const invoice = invoicesOf({ ...quote, ...patch })[0]

  // The two conditions make this safe to call twice: only a quote that is
  // accepted and has no invoice yet is touched, so a repeated request (or the
  // professional pressing Send invoice at the same moment) cannot issue two.
  const { data: updated, error } = await admin
    .from('quotes')
    .update(patch)
    .eq('id', quote.id)
    .eq('status', 'accepted')
    .is('invoice_number', null)
    .select('id')
  if (error || !updated || updated.length === 0) return null
  if (billedIds.length) await admin.from('job_expenses').update({ billed_invoice_number: patch.invoice_number }).in('id', billedIds)

  if (quote.message_id) {
    // quote_id on the reply is what makes the client see a downloadable
    // invoice card in the conversation, not just a line of text.
    await admin.from('message_replies').insert({
      message_id: quote.message_id,
      sender_name: freelancer?.name || 'Your professional',
      sender_user_id: freelancer?.user_id || null,
      quote_id: quote.id,
      body: invoiceReplyBody(patch.invoice_number, patch.invoice_due_date, termsValue, invoice.kind),
    })
    await admin.from('messages').update({ client_read: false }).eq('id', quote.message_id)
    try {
      await notifyThreadClient(admin, {
        messageId: quote.message_id,
        kind: 'invoice',
        message: invoiceSummary(patch.invoice_number, invoice.amount, patch.invoice_due_date, invoice.kind, patch.billed_expenses_total || 0),
      })
    } catch (err) {
      // The invoice is sent and in the conversation; a failed email or push
      // must not undo that.
      console.error('auto-invoice notify failed:', err.message)
    }
  }

  return {
    invoice_number: patch.invoice_number,
    invoice_due_date: patch.invoice_due_date,
    is_deposit: invoice.kind === 'deposit',
    invoice_amount: invoice.amount,
  }
}
