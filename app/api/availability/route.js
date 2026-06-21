import { createClient } from '@supabase/supabase-js'

// Public booking availability for a freelancer. Returns the booking config +
// which dates are blocked (time off) + which slots are taken — computed with
// the service role so the client UI can render open days/slots WITHOUT being
// able to read the freelancer's private appointment details directly.
export async function GET(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ enabled: false })

    const { searchParams } = new URL(request.url)
    const freelancerId = searchParams.get('freelancer_id')
    if (!freelancerId) return Response.json({ error: 'freelancer_id required' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)

    const { data: settings } = await admin
      .from('availability_settings')
      .select('bookings_enabled, booking_mode, work_days, work_start, work_end, lead_time_days')
      .eq('freelancer_id', freelancerId)
      .maybeSingle()
    if (!settings?.bookings_enabled) return Response.json({ enabled: false })

    const { data: services } = await admin
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('freelancer_id', freelancerId).eq('bookable', true)
      .order('created_at', { ascending: true })
    if (!services?.length) return Response.json({ enabled: false })

    const today = new Date().toISOString().slice(0, 10)
    const { data: appts } = await admin
      .from('appointments')
      .select('date, start_time, status')
      .eq('freelancer_id', freelancerId).gte('date', today)

    const blockedDates = [...new Set((appts || []).filter(a => a.status === 'blocked').map(a => a.date))]
    const takenSlots = {}
    for (const a of appts || []) {
      if (a.status !== 'blocked' && a.start_time) (takenSlots[a.date] = takenSlots[a.date] || []).push(a.start_time)
    }

    return Response.json({
      enabled: true,
      mode: settings.booking_mode || 'day',
      work_days: settings.work_days || [1, 2, 3, 4, 5],
      work_start: settings.work_start || '09:00',
      work_end: settings.work_end || '17:00',
      lead_time_days: settings.lead_time_days ?? 1,
      services: services || [],
      blockedDates,
      takenSlots,
    })
  } catch {
    return Response.json({ enabled: false })
  }
}
