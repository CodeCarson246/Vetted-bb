import { buildInvoicePatch, invoiceReplyBody, invoiceSummary, invoiceTermsFor } from '@/lib/invoicing'
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
  const patch = buildInvoicePatch({
    issuedKey: todayKeyBarbados(),
    nowIso: new Date().toISOString(),
    termsValue,
  })

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

  if (quote.message_id) {
    // quote_id on the reply is what makes the client see a downloadable
    // invoice card in the conversation, not just a line of text.
    await admin.from('message_replies').insert({
      message_id: quote.message_id,
      sender_name: freelancer?.name || 'Your professional',
      sender_user_id: freelancer?.user_id || null,
      quote_id: quote.id,
      body: invoiceReplyBody(patch.invoice_number, patch.invoice_due_date, termsValue),
    })
    await admin.from('messages').update({ client_read: false }).eq('id', quote.message_id)
    try {
      await notifyThreadClient(admin, {
        messageId: quote.message_id,
        kind: 'invoice',
        message: invoiceSummary(patch.invoice_number, quote.total, patch.invoice_due_date),
      })
    } catch (err) {
      // The invoice is sent and in the conversation; a failed email or push
      // must not undo that.
      console.error('auto-invoice notify failed:', err.message)
    }
  }

  return { invoice_number: patch.invoice_number, invoice_due_date: patch.invoice_due_date }
}
