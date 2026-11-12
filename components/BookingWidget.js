'use client'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useAvailability, refreshAvailability } from '@/lib/useAvailability'
import { priceRental, addDays, perLabel, unitLabel, fmtDay } from '@/lib/rentals'
import RentalDatePicker from '@/components/RentalDatePicker'
import Icon from '@/components/Icon'

const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const bds = n => `Bds$${Number(n).toFixed(2)}`

function buildSlots(work_start, work_end, durationMin, taken) {
  const [sh, sm] = (work_start || '09:00').split(':').map(Number)
  const [eh, em] = (work_end || '17:00').split(':').map(Number)
  const start = sh * 60 + sm, end = eh * 60 + em
  const step = durationMin || 60
  const out = []
  for (let t = start; t + step <= end; t += step) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0')
    const mm = String(t % 60).padStart(2, '0')
    const v = `${hh}:${mm}`
    if (!(taken || []).includes(v)) out.push(v)
  }
  return out
}
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
}

// Two kinds of booking share this panel. An ordinary service is requested for
// a day (or a time slot). A RENTAL (a car, an apartment: one customer at a
// time) is requested for a run of dates on a calendar that greys out the days
// that item is already out, and is priced as the dates are picked, with any
// length-of-rental discount the owner set applied automatically.
export default function BookingWidget({ freelancerId, freelancerName }) {
  const { user } = useAuth()
  const config = useAvailability(freelancerId) // null=loading, {enabled:false}=off
  const rootRef = useRef(null)
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [range, setRange] = useState({ start: null, end: null })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // null | { rental?: pricing }
  const [error, setError] = useState(null)

  // An item's own "Check dates" button opens the panel on that item.
  useEffect(() => {
    const onPick = e => {
      setServiceId(e.detail?.serviceId || '')
      setRange({ start: null, end: null }); setDate(''); setSlot(''); setDone(null); setError(null)
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('vetted:book-service', onPick)
    return () => window.removeEventListener('vetted:book-service', onPick)
  }, [])

  const services = config?.enabled ? config.services || [] : []
  const service = services.find(s => s.id === serviceId) || services[0] || null
  const isRental = !!service?.rental

  const minDate = useMemo(() => {
    const lead = config?.lead_time_days ?? 1
    if (config?.today) return addDays(config.today, lead)
    const d = new Date(); d.setDate(d.getDate() + lead); return toKey(d)
  }, [config])

  const slots = useMemo(() => {
    if (!config?.enabled || config.mode !== 'slot' || !date || !service || isRental) return []
    return buildSlots(config.work_start, config.work_end, service.duration_minutes || 60, config.takenSlots?.[date])
  }, [config, date, service, isRental])

  const pricing = useMemo(
    () => (isRental && range.start && range.end ? priceRental(service, range.start, range.end) : null),
    [isRental, service, range],
  )

  if (config === null) return null
  if (!config.enabled || !service) return null

  const isBlocked = date && config.blockedDates?.includes(date)
  const isWorkDay = !date || (config.mode !== 'slot') || (config.work_days || []).includes(new Date(date + 'T12:00:00').getDay())

  function chooseService(id) {
    setServiceId(id); setSlot(''); setRange({ start: null, end: null }); setError(null)
  }

  async function submit() {
    setError(null)
    if (isRental) {
      if (!pricing) { setError(service.price_unit === 'night' ? 'Pick your check-in and check-out dates.' : 'Pick the first and last day you need it.'); return }
    } else {
      if (!date) { setError('Pick a date.'); return }
      if (config.mode === 'slot' && !slot) { setError('Pick a time slot.'); return }
    }
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch('/api/request-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(isRental
        ? { freelancer_id: freelancerId, service_id: service.id, date: range.start, end_date: range.end, note }
        : { freelancer_id: freelancerId, service_id: service.id, date, start_time: slot || null, note }),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(out.error || 'Could not send the request.')
      // Someone else's dates were confirmed while this page was open.
      if (res.status === 409) { setRange({ start: null, end: null }); refreshAvailability() }
      return
    }
    setDone({ rental: out.rental || null })
  }

  const night = service.price_unit === 'night'
  const intro = isRental
    ? 'Greyed-out dates are taken. Pick yours and send a request.'
    : config.mode === 'slot' ? 'Pick an open time and send a request.' : 'Request a day. You’ll confirm the time together.'

  return (
    <div ref={rootRef} id="booking" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6" style={{ scrollMarginTop: 90 }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--accent)' }}>
        <Icon name="calendar" size={18} />
        <h2 className="font-bold text-gray-900">{isRental ? 'Check dates and book' : 'Request a booking'}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{intro}</p>

      {done ? (
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}>
          <p className="font-semibold" style={{ color: '#16a34a' }}>Request sent ✓</p>
          <p className="text-sm text-gray-500 mt-1">
            {freelancerName || 'The owner'} will confirm or decline, and you’ll be notified.
            {done.rental ? ` Once confirmed, you’ll get a quote for ${bds(done.rental.total)} in your messages.` : ''}
          </p>
        </div>
      ) : !user ? (
        <Link href="/login" className="block text-center text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Log in to request a booking</Link>
      ) : (
        <div className="flex flex-col gap-3">
          {(services.length > 1 || !isRental) && (
            <div>
              <label htmlFor="bk-service" className="block text-xs font-semibold text-gray-500 mb-1">{isRental ? 'Which one' : 'Service'}</label>
              <select id="bk-service" value={service.id} onChange={e => chooseService(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400">
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.rental ? ` · Bds$${s.price} ${perLabel(s.price_unit)}` : s.duration_minutes ? ` · ${s.duration_minutes >= 60 ? `${s.duration_minutes / 60}h` : `${s.duration_minutes}m`}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isRental ? (
            <>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--row-stripe)' }}>
                <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-600">Bds${service.price} {perLabel(service.price_unit)}</p>
                {service.length_discounts.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#16a34a', fontWeight: 600 }}>
                    {service.length_discounts.map(t => `${t.percent}% off ${t.min}+ ${unitLabel(service.price_unit, 2)}`).join(' · ')}
                  </p>
                )}
              </div>

              <RentalDatePicker
                key={service.id}
                unit={service.price_unit}
                taken={config.rentalTaken?.[service.id] || []}
                minDate={minDate}
                start={range.start}
                end={range.end}
                onChange={setRange}
              />

              {pricing && (
                <div className="rounded-xl px-4 py-3.5" style={{ border: '1px solid var(--border-card)' }}>
                  <div className="flex items-baseline justify-between gap-3 text-sm text-gray-600">
                    <span>{fmtDay(range.start)} to {fmtDay(range.end)}</span>
                    <span className="tabular-nums">{pricing.units} {unitLabel(pricing.unit, pricing.units)} × {bds(pricing.unitPrice)}</span>
                  </div>
                  {pricing.discountPct > 0 && (
                    <p className="text-xs mt-1" style={{ color: '#16a34a', fontWeight: 600 }}>
                      {pricing.discountPct}% off for {pricing.discountMin}+ {unitLabel(pricing.unit, 2)} applied. You save {bds(pricing.saving)}.
                    </p>
                  )}
                  <div className="flex items-baseline justify-between gap-3 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border-card)' }}>
                    <span className="text-sm font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{bds(pricing.total)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label htmlFor="bk-date" className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                <input id="bk-date" type="date" min={minDate} value={date} onChange={e => { setDate(e.target.value); setSlot('') }} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" />
                {isBlocked && <p className="text-xs text-red-500 mt-1">Unavailable on that date. Please pick another.</p>}
                {!isWorkDay && !isBlocked && <p className="text-xs text-red-500 mt-1">Not a working day. Please pick another.</p>}
              </div>

              {config.mode === 'slot' && date && !isBlocked && isWorkDay && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Time</label>
                  {slots.length === 0 ? (
                    <p className="text-sm text-gray-400">No open slots that day.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map(s => (
                        <button key={s} onClick={() => setSlot(s)} className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 transition-colors" style={slot === s ? { borderColor: '#00267F', backgroundColor: 'var(--selected-fill)', color: 'var(--accent)' } : { borderColor: 'var(--border-card)', color: '#6B7280' }}>{fmtTime(s)}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="bk-note" className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</label>
            <textarea id="bk-note" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder={isRental ? (night ? 'Number of guests, arrival time, anything else' : 'Pick-up time, where you are staying, anything else') : 'Anything the professional should know'} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={submit} disabled={busy || (isRental ? !pricing : (isBlocked || !isWorkDay))} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
            {busy ? 'Sending…' : isRental && pricing ? `Request these dates · ${bds(pricing.total)}` : 'Request booking'}
          </button>
          {isRental && (
            <p className="text-xs text-gray-400 -mt-1">Nothing is charged here. The owner confirms, then sends you a quote.</p>
          )}
        </div>
      )}
    </div>
  )
}
