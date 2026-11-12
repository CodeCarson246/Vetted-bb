import { createClient } from '@supabase/supabase-js'
import { normaliseDiscounts, todayKeyBarbados, addDays, daysBetween, MAX_RENTAL_UNITS } from '@/lib/rentals'

// Public booking availability for a freelancer. Returns the booking config +
// which dates are blocked (time off) + which slots are taken + which dates
// each RENTAL item is out, computed with the service role so the client UI
// can render open days WITHOUT being able to read the freelancer's private
// appointment details directly. Only dates leave this route: never a
// client's name, a title or a note.
//
// select('*') on purpose: the rental columns arrive with SQL section 36, and
// naming them would make this whole route fail (and every booking widget
// vanish) on a database that has not run it yet.
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

    const { data: rows } = await admin
      .from('services')
      .select('*')
      .eq('freelancer_id', freelancerId)
      .order('created_at', { ascending: true })
    // A rental is bookable by nature; ordinary services only when ticked.
    const services = (rows || []).filter(s => s.bookable || s.rental).map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      price_type: s.price_type || 'fixed',
      duration_minutes: s.duration_minutes ?? null,
      business_group: s.business_group || null,
      rental: !!s.rental,
      price_unit: s.rental ? (s.price_unit === 'night' ? 'night' : 'day') : null,
      length_discounts: s.rental ? normaliseDiscounts(s.length_discounts) : [],
    }))
    if (!services.length) return Response.json({ enabled: false })

    const today = todayKeyBarbados()
    // A multi-day entry that began before today can still cover today, so
    // look back as far as the longest rental allowed.
    const { data: appts } = await admin
      .from('appointments')
      .select('*')
      .eq('freelancer_id', freelancerId)
      .gte('date', addDays(today, -MAX_RENTAL_UNITS))

    const live = (appts || [])
      .map(a => ({ ...a, end: a.end_date && a.end_date >= a.date ? a.end_date : a.date }))
      .filter(a => a.end >= today)

    // Time off with no item attached closes the whole profile.
    const wholeProfile = live.filter(a => a.status === 'blocked' && !a.service_id)
    const blockedDates = new Set()
    for (const a of wholeProfile) {
      for (let i = 0; i <= daysBetween(a.date, a.end); i++) blockedDates.add(addDays(a.date, i))
    }

    // A declined request must not go on holding its slot.
    const takenSlots = {}
    for (const a of live) {
      if (['confirmed', 'pending'].includes(a.status) && a.start_time) {
        (takenSlots[a.date] = takenSlots[a.date] || []).push(a.start_time)
      }
    }

    // Per rental item: confirmed bookings of it, blocks placed on it, and
    // whole-profile time off. Pending requests do not hold dates; the owner
    // decides between them.
    const rentalTaken = {}
    for (const s of services.filter(x => x.rental)) {
      rentalTaken[s.id] = [
        ...live.filter(a => a.service_id === s.id && ['confirmed', 'blocked'].includes(a.status)),
        ...wholeProfile,
      ].map(a => ({ start: a.date, end: a.end }))
    }

    return Response.json({
      enabled: true,
      mode: settings.booking_mode || 'day',
      work_days: settings.work_days || [1, 2, 3, 4, 5],
      work_start: settings.work_start || '09:00',
      work_end: settings.work_end || '17:00',
      lead_time_days: settings.lead_time_days ?? 1,
      today,
      services,
      blockedDates: [...blockedDates].sort(),
      takenSlots,
      rentalTaken,
    })
  } catch {
    return Response.json({ enabled: false })
  }
}
