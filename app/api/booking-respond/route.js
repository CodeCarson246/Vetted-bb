import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'

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
      .select('id, date, start_time, title, freelancer_id, client_user_id, freelancers(user_id, name, company_name)')
      .eq('id', appointment_id).maybeSingle()
    if (!appt) return Response.json({ error: 'Booking not found' }, { status: 404 })
    if (appt.freelancers?.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

    const newStatus = action === 'confirm' ? 'confirmed' : 'declined'
    const { error: upErr } = await admin.from('appointments').update({ status: newStatus }).eq('id', appointment_id)
    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

    if (appt.client_user_id) {
      const fname = appt.freelancers?.company_name?.trim().length > 3 ? appt.freelancers.company_name : appt.freelancers?.name || 'The professional'
      const when = new Date(appt.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      await createNotification(appt.client_user_id, {
        type: action === 'confirm' ? 'booking_confirmed' : 'booking_declined',
        title: action === 'confirm' ? `${fname} confirmed your booking` : `${fname} declined your booking`,
        body: `${appt.title} · ${when}${appt.start_time ? ` · ${appt.start_time}` : ''}`,
        link: `/freelancers/${appt.freelancer_id}`,
      })
      sendPushToUser(appt.client_user_id, {
        title: action === 'confirm' ? 'Booking confirmed' : 'Booking declined',
        body: `${appt.title} · ${when}`,
        url: `/freelancers/${appt.freelancer_id}`,
      }).catch(() => {})
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
