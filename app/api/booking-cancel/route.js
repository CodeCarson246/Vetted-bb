import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'

// A client cancels their own PENDING booking request. Deletes it (service role —
// clients can't delete appointments via RLS) and notifies the freelancer.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointment_id } = await request.json()
    if (!appointment_id) return Response.json({ error: 'Missing booking id' }, { status: 400 })

    const { data: appt } = await admin
      .from('appointments')
      .select('id, date, title, status, client_user_id, client_name, freelancer_id, freelancers(user_id)')
      .eq('id', appointment_id).maybeSingle()
    if (!appt) return Response.json({ error: 'Booking not found' }, { status: 404 })
    if (appt.client_user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (appt.status !== 'pending') return Response.json({ error: 'Only pending requests can be cancelled.' }, { status: 400 })

    const { error: delErr } = await admin.from('appointments').delete().eq('id', appointment_id)
    if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

    if (appt.freelancers?.user_id) {
      const when = new Date(appt.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      await createNotification(appt.freelancers.user_id, {
        type: 'booking_declined',
        title: `${appt.client_name || 'A client'} cancelled their booking request`,
        body: `${appt.title} · ${when}`,
        link: '/calendar',
      })
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
