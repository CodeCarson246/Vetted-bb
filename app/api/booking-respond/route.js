import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'
import { isRangeFree, fmtDay, customerEnd, todayKeyBarbados, addDays, MAX_RENTAL_UNITS } from '@/lib/rentals'
import { sendRentalQuoteOnConfirm } from '@/lib/serverQuote'

// The freelancer confirms or declines a pending client booking request. Updates
// the appointment status and notifies the client (service role — the client
// notification can't be written by the freelancer's own session).
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointment_id, action } = await request.json()
    if (!appointment_id || !['confirm', 'decline'].includes(action)) return Response.json({ error: 'Invalid request' }, { status: 400 })

    const { data: appt } = await admin
      .from('appointments')
      .select('*, freelancers(user_id, name, company_name)')
      .eq('id', appointment_id).maybeSingle()
    if (!appt) return Response.json({ error: 'Booking not found' }, { status: 404 })
    if (appt.freelancers?.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

    // A rental item can only be out with one customer at a time. Several
    // people may have asked for overlapping dates; confirming one must not
    // be possible once another is confirmed (or the item has been blocked).
    const isRental = !!appt.rental && !!appt.service_id
    const apptEnd = appt.end_date && appt.end_date >= appt.date ? appt.end_date : appt.date
    if (action === 'confirm' && isRental) {
      const { data: others } = await admin
        .from('appointments')
        .select('*')
        .eq('freelancer_id', appt.freelancer_id)
        .neq('id', appt.id)
        .gte('date', addDays(todayKeyBarbados(), -MAX_RENTAL_UNITS))
      const taken = (others || [])
        .filter(a => (a.service_id === appt.service_id && ['confirmed', 'blocked'].includes(a.status)) || (a.status === 'blocked' && !a.service_id))
        .map(a => ({ start: a.date, end: a.end_date && a.end_date >= a.date ? a.end_date : a.date }))
      if (!isRangeFree(appt.date, apptEnd, taken)) {
        return Response.json({
          error: `${appt.title} is already booked or blocked for some of those dates. Decline this request, or free the dates first.`,
        }, { status: 409 })
      }
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'declined'
    const { error: upErr } = await admin.from('appointments').update({ status: newStatus }).eq('id', appointment_id)
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

    // Confirming a rental sends its quote. The customer saw the price when
    // they picked the dates, so there is nothing for the professional to
    // type: making them go to the inbox to send it only keeps the customer
    // waiting. A failure here never undoes the confirmation; the quote can
    // still be sent by hand from the conversation.
    let quote = null
    if (action === 'confirm' && isRental) {
      try {
        quote = await sendRentalQuoteOnConfirm(admin, appt)
      } catch (err) {
        console.error('rental quote on confirm failed:', err.message)
      }
    }

    if (appt.client_user_id) {
      const fname = appt.freelancers?.company_name?.trim().length > 3 ? appt.freelancers.company_name : appt.freelancers?.name || 'The professional'
      const when = isRental
        ? `${fmtDay(appt.date)} to ${fmtDay(customerEnd(appt.rental.unit, apptEnd))}`
        : new Date(appt.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      await createNotification(appt.client_user_id, {
        type: action === 'confirm' ? 'booking_confirmed' : 'booking_declined',
        title: action === 'confirm' ? `${fname} confirmed your booking` : `${fname} declined your booking`,
        body: `${appt.title} · ${when}${appt.start_time ? ` · ${appt.start_time}` : ''}${quote ? '. Your quote is in your messages.' : ''}`,
        link: quote ? '/messages' : '/bookings',
      })
      sendPushToUser(appt.client_user_id, {
        title: action === 'confirm' ? 'Booking confirmed' : 'Booking declined',
        body: `${appt.title} · ${when}`,
        url: `/freelancers/${appt.freelancer_id}`,
      }).catch(() => {})
    }

    return Response.json({ success: true, quote })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
