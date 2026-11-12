import { quoteNumberFor, rentalQuoteContent, rentalQuoteValidUntil, RENTAL_QUOTE_TERMS } from '@/lib/rentalQuote'
import { invoiceDueDate } from '@/lib/invoicing'
import { todayKeyBarbados } from '@/lib/rentals'
import { generateVerifyCode } from '@/lib/verifyCode'
import { formatAddressBlock } from '@/lib/addressBlock'
import { notifyThreadClient } from '@/lib/serverThreadNotify'

// Server-only. When a professional confirms a rental booking, the quote
// follows by itself: the customer already saw the price when they picked
// the dates, so there is nothing left for the professional to type.
//
// It is the same row the quote builder would have saved: their name and
// address, their standard terms, the price the customer was shown, in the
// conversation the booking request opened. It also takes on their usual
// "send the invoice automatically" choice.
//
// Returns { id, quote_number, total, client_name }, or null when no quote
// was sent (no conversation, nothing usable to price, or the professional
// has already quoted this request by hand).
export async function sendRentalQuoteOnConfirm(admin, appt) {
  if (!appt?.message_id || !appt.rental) return null
  if (appt.quote_id) return null

  const content = rentalQuoteContent(appt.title, appt.rental)
  if (!content) return null

  const [{ data: msg }, { data: freelancer }, { data: billing }, { data: existing }] = await Promise.all([
    admin.from('messages').select('*').eq('id', appt.message_id).maybeSingle(),
    admin.from('freelancers').select('*').eq('id', appt.freelancer_id).maybeSingle(),
    admin.from('freelancer_billing').select('*').eq('freelancer_id', appt.freelancer_id).maybeSingle(),
    admin.from('quotes').select('id, created_at, status').eq('message_id', appt.message_id),
  ])
  if (!msg || !freelancer) return null

  // Already quoted since the request came in (they opened the conversation
  // and sent one themselves): do not send a second.
  // (Older quotes on the thread do not count: one conversation serves every
  // booking between the same two people.)
  const since = Date.parse(appt.created_at || '')
  const quotedSince = (existing || []).some(q =>
    q.status !== 'declined' && Number.isFinite(since) && Date.parse(q.created_at || '') >= since)
  if (quotedSince) return null

  let service = null
  if (appt.service_id) {
    const { data } = await admin.from('services').select('*').eq('id', appt.service_id).maybeSingle()
    service = data || null
  }
  let organisation = null
  if (msg.organisation_id) {
    const { data } = await admin.from('organisations').select('*').eq('id', msg.organisation_id).maybeSingle()
    organisation = data || null
  }

  const today = todayKeyBarbados()
  const quoteNumber = quoteNumberFor(today)
  const row = {
    message_id: msg.id,
    freelancer_id: freelancer.id,
    quote_number: quoteNumber,
    quote_date: today,
    payment_terms: RENTAL_QUOTE_TERMS,
    due_date: invoiceDueDate(today, RENTAL_QUOTE_TERMS),
    client_name: organisation?.name || appt.client_name || msg.sender_name || 'Client',
    client_email: appt.client_email || msg.sender_email || null,
    items: content.items,
    subtotal: content.total,
    total: content.total,
    notes: content.notes,
    business_group: service?.business_group || null,
    organisation_id: msg.organisation_id ?? null,
    quote_request_id: msg.quote_request_id ?? null,
    verify_code: generateVerifyCode(),
    currency: 'BBD',
    reference: null,
    valid_until: rentalQuoteValidUntil(today, appt.rental.start),
    client_phone: null,
    client_address: null,
    terms: (freelancer.default_terms || '').trim() || null,
    from_address: formatAddressBlock(billing) || null,
    bill_to_division: organisation?.division || null,
    bill_to_address: formatAddressBlock(organisation) || null,
    status: 'sent',
    // Only written when it is on, so this never depends on the column existing.
    ...(freelancer.auto_invoice_default === true ? { auto_invoice: true } : {}),
  }

  const { data: quote, error } = await admin.from('quotes').insert(row).select().single()
  if (error || !quote) {
    console.error('rental quote failed:', error?.message)
    return null
  }

  // quote_id on the reply is what shows the quote card in the conversation.
  await admin.from('message_replies').insert({
    message_id: msg.id,
    sender_name: freelancer.name,
    sender_user_id: freelancer.user_id || null,
    body: `Sent quote ${quoteNumber}`,
    quote_id: quote.id,
  })
  await admin.from('appointments').update({ quote_id: quote.id }).eq('id', appt.id)
  await admin.from('messages').update({ client_read: false }).eq('id', msg.id)
  try {
    await notifyThreadClient(admin, { messageId: msg.id, kind: 'quote' })
  } catch (err) {
    // The quote is saved and in the conversation; a failed email or push
    // must not undo that.
    console.error('rental quote notify failed:', err.message)
  }

  return { id: quote.id, quote_number: quoteNumber, total: content.total, client_name: row.client_name }
}
