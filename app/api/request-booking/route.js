import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import {
  isDateKey, rentalUnits, occupiedRange, priceRental, isRangeFree, rentalEnquiryLine,
  todayKeyBarbados, addDays, fmtDay, unitLabel, MAX_RENTAL_UNITS,
} from '@/lib/rentals'

// A logged-in client requests a booking from a freelancer's profile. Creates a
// PENDING appointment (service role — clients can't write appointments) and
// notifies the freelancer, who confirms/declines in their calendar.
//
// A RENTAL request (a car, an apartment: one customer at a time, for a run of
// days) does three more things. It checks the item is actually free for those
// dates, it prices the stay itself from the service row (the figure a browser
// sends is never trusted), and it opens the conversation the quote will be
// sent in, with a line the inbox can turn into that quote in one tap.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Bookings are not configured.' }, { status: 500 })

    if (!rateLimit(`book:${clientIp(request)}`, { limit: 8, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Please log in to request a booking.' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Please log in to request a booking.' }, { status: 401 })

    const { freelancer_id, service_id, date, end_date, start_time, note } = await request.json()
    if (!freelancer_id || !service_id || !date) return Response.json({ error: 'Missing required fields.' }, { status: 400 })

    const { data: settings } = await admin.from('availability_settings').select('bookings_enabled, booking_mode, lead_time_days').eq('freelancer_id', freelancer_id).maybeSingle()
    if (!settings?.bookings_enabled) return Response.json({ error: 'This professional is not accepting bookings.' }, { status: 400 })

    // '*' so this keeps working on a database without the rental columns.
    const { data: svc } = await admin.from('services').select('*').eq('id', service_id).maybeSingle()
    if (!svc || svc.freelancer_id !== freelancer_id || !(svc.bookable || svc.rental)) {
      return Response.json({ error: 'That service is not available for booking.' }, { status: 400 })
    }

    const { data: freelancer } = await admin.from('freelancers').select('user_id, name, hidden, deactivated_at').eq('id', freelancer_id).maybeSingle()
    if (freelancer?.user_id === user.id) return Response.json({ error: 'You cannot book your own services.' }, { status: 400 })
    if (!freelancer || freelancer.hidden || freelancer.deactivated_at) {
      return Response.json({ error: 'This professional is not accepting bookings.' }, { status: 400 })
    }

    const { data: cp } = await admin.from('client_profiles').select('display_name').eq('user_id', user.id).maybeSingle()
    const clientName = cp?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client'
    const cleanNote = note ? String(note).slice(0, 500) : null

    if (svc.rental) {
      return await requestRental({ admin, user, clientName, cleanNote, svc, freelancer, freelancer_id, settings, start: date, end: end_date })
    }

    const slotMode = settings.booking_mode === 'slot'

    const { error: insErr } = await admin.from('appointments').insert({
      freelancer_id,
      service_id,
      quote_id: null,
      title: svc.name,
      client_name: clientName,
      client_email: user.email,
      client_user_id: user.id,
      date,
      start_time: slotMode ? (start_time || null) : null,
      duration_min: svc.duration_minutes || 60,
      status: 'pending',
      notes: cleanNote,
    })
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 })

    const when = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (freelancer?.user_id) {
      await createNotification(freelancer.user_id, {
        type: 'booking_request',
        title: `New booking request from ${clientName}`,
        body: `${svc.name} · ${when}${slotMode && start_time ? ` · ${start_time}` : ''}`,
        link: '/calendar',
      })
      sendPushToUser(freelancer.user_id, { title: `Booking request from ${clientName}`, body: `${svc.name} · ${when}`, url: '/calendar' }).catch(() => {})
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

async function requestRental({ admin, user, clientName, cleanNote, svc, freelancer, freelancer_id, settings, start, end }) {
  const unit = svc.price_unit === 'night' ? 'night' : 'day'
  const night = unit === 'night'

  if (!isDateKey(start) || !isDateKey(end) || rentalUnits(unit, start, end) === 0) {
    return Response.json({
      error: night ? 'Pick a check-in date and a later check-out date.' : 'Pick the first and last day you need it.',
    }, { status: 400 })
  }

  const today = todayKeyBarbados()
  const earliest = addDays(today, Math.max(0, Number(settings.lead_time_days ?? 1)))
  if (start < earliest) {
    return Response.json({ error: `The earliest start is ${fmtDay(earliest)}.` }, { status: 400 })
  }

  const pricing = priceRental(svc, start, end)
  if (!pricing) return Response.json({ error: 'This item has no price set yet. Message the owner instead.' }, { status: 400 })

  // Is the item free? Confirmed bookings of it, blocks placed on it, and
  // time off across the whole profile all take it off the market.
  const occ = occupiedRange(unit, start, end)
  const { data: appts, error: readErr } = await admin
    .from('appointments')
    .select('*')
    .eq('freelancer_id', freelancer_id)
    .gte('date', addDays(today, -MAX_RENTAL_UNITS))
  if (readErr) return Response.json({ error: readErr.message }, { status: 500 })
  const taken = (appts || [])
    .filter(a => (a.service_id === svc.id && ['confirmed', 'blocked'].includes(a.status)) || (a.status === 'blocked' && !a.service_id))
    .map(a => ({ start: a.date, end: a.end_date && a.end_date >= a.date ? a.end_date : a.date }))
  if (!isRangeFree(occ.start, occ.end, taken)) {
    return Response.json({ error: 'Those dates have just been taken. Please pick different dates.' }, { status: 409 })
  }

  const { data: appt, error: insErr } = await admin.from('appointments').insert({
    freelancer_id,
    service_id: svc.id,
    quote_id: null,
    title: svc.name,
    client_name: clientName,
    client_email: user.email,
    client_user_id: user.id,
    date: occ.start,
    end_date: occ.end,
    start_time: null,
    duration_min: null,
    status: 'pending',
    notes: cleanNote,
    // What the customer was shown, kept even if the owner later changes the rate.
    rental: { ...pricing, start, end },
  }).select('id').single()
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 })

  // The conversation the quote will be sent in. One thread per client and
  // professional, the same rule the profile's contact form follows.
  const money = n => `$${n.toFixed(2)}`
  const text = [
    `Booking request for ${svc.name}`,
    '',
    rentalEnquiryLine(svc.name, start, end, pricing),
    '',
    `${night ? 'Check-in' : 'First day'}: ${fmtDay(start)}`,
    `${night ? 'Check-out' : 'Last day'}: ${fmtDay(end)}`,
    `Total for ${pricing.units} ${unitLabel(unit, pricing.units)}: ${money(pricing.total)}${pricing.saving > 0 ? ` (saving ${money(pricing.saving)})` : ''}`,
    ...(cleanNote ? ['', `Note: ${cleanNote}`] : []),
  ].join('\n')

  let messageId = null
  try {
    const { data: threads } = await admin
      .from('messages').select('id')
      .eq('freelancer_id', freelancer_id).eq('sender_email', user.email).is('organisation_id', null)
      .order('created_at', { ascending: true }).limit(1)
    if (threads?.[0]) {
      messageId = threads[0].id
      await admin.from('message_replies').insert({
        message_id: messageId, sender_name: clientName, sender_user_id: user.id,
        body: `--- New booking request ---\n\n${text}`,
      })
      await admin.from('messages').update({ read: false }).eq('id', messageId)
    } else {
      const { data: created } = await admin.from('messages').insert({
        freelancer_id, sender_name: clientName, sender_email: user.email, sender_user_id: user.id,
        subject: `Booking request: ${svc.name}`, message: text,
        created_at: new Date().toISOString(), read: false,
      }).select('id').single()
      messageId = created?.id || null
    }
    if (messageId) await admin.from('appointments').update({ message_id: messageId }).eq('id', appt.id)
  } catch { /* the request itself is saved; the thread is a convenience */ }

  const when = `${fmtDay(start)} to ${fmtDay(end)}`
  if (freelancer?.user_id) {
    await createNotification(freelancer.user_id, {
      type: 'booking_request',
      title: `New booking request from ${clientName}`,
      body: `${svc.name} · ${when} · Bds${money(pricing.total)}`,
      link: '/calendar',
    })
    sendPushToUser(freelancer.user_id, { title: `Booking request from ${clientName}`, body: `${svc.name} · ${when}`, url: '/calendar' }).catch(() => {})
  }

  return Response.json({ success: true, rental: pricing })
}
