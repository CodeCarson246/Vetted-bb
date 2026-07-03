import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'
import { rateLimit, clientIp } from '@/lib/rateLimit'

// A logged-in client requests a booking from a freelancer's profile. Creates a
// PENDING appointment (service role — clients can't write appointments) and
// notifies the freelancer, who confirms/declines in their calendar.
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

    const { freelancer_id, service_id, date, start_time, note } = await request.json()
    if (!freelancer_id || !service_id || !date) return Response.json({ error: 'Missing required fields.' }, { status: 400 })

    const { data: settings } = await admin.from('availability_settings').select('bookings_enabled, booking_mode').eq('freelancer_id', freelancer_id).maybeSingle()
    if (!settings?.bookings_enabled) return Response.json({ error: 'This professional is not accepting bookings.' }, { status: 400 })

    const { data: svc } = await admin.from('services').select('id, name, duration_minutes, bookable').eq('id', service_id).maybeSingle()
    if (!svc?.bookable) return Response.json({ error: 'That service is not available for booking.' }, { status: 400 })

    const { data: freelancer } = await admin.from('freelancers').select('user_id, name, hidden, deactivated_at').eq('id', freelancer_id).maybeSingle()
    if (freelancer?.user_id === user.id) return Response.json({ error: 'You cannot book your own services.' }, { status: 400 })
    if (!freelancer || freelancer.hidden || freelancer.deactivated_at) {
      return Response.json({ error: 'This professional is not accepting bookings.' }, { status: 400 })
    }

    const { data: cp } = await admin.from('client_profiles').select('display_name').eq('user_id', user.id).maybeSingle()
    const clientName = cp?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client'
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
      notes: note ? String(note).slice(0, 500) : null,
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
