'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

export default function BookingWidget({ freelancerId, freelancerName }) {
  const { user } = useAuth()
  const [config, setConfig] = useState(null) // null=loading, {enabled:false}=off
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/availability?freelancer_id=${freelancerId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setConfig(d); if (d.enabled && d.services?.[0]) setServiceId(d.services[0].id) } })
      .catch(() => { if (!cancelled) setConfig({ enabled: false }) })
    return () => { cancelled = true }
  }, [freelancerId])

  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + (config?.lead_time_days ?? 1))
    return toKey(d)
  }, [config])

  const service = config?.services?.find(s => s.id === serviceId)
  const slots = useMemo(() => {
    if (!config?.enabled || config.mode !== 'slot' || !date || !service) return []
    return buildSlots(config.work_start, config.work_end, service.duration_minutes || 60, config.takenSlots?.[date])
  }, [config, date, service])

  if (config === null) return null
  if (!config.enabled) return null

  const isBlocked = date && config.blockedDates?.includes(date)
  const isWorkDay = !date || (config.mode !== 'slot') || (config.work_days || []).includes(new Date(date + 'T12:00:00').getDay())

  async function submit() {
    setError(null)
    if (!serviceId || !date) { setError('Pick a service and date.'); return }
    if (config.mode === 'slot' && !slot) { setError('Pick a time slot.'); return }
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch('/api/request-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ freelancer_id: freelancerId, service_id: serviceId, date, start_time: slot || null, note }),
    })
    const out = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(out.error || 'Could not send the request.'); return }
    setDone(true)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <svg width="18" height="18" fill="none" stroke="#00267F" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
        <h2 className="font-bold text-gray-900">Request a booking</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{config.mode === 'slot' ? 'Pick an open time and send a request.' : 'Request a day — you’ll confirm the time together.'}</p>

      {done ? (
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}>
          <p className="font-semibold" style={{ color: '#16a34a' }}>Request sent ✓</p>
          <p className="text-sm text-gray-500 mt-1">{freelancerName || 'The professional'} will confirm or decline — you’ll be notified.</p>
        </div>
      ) : !user ? (
        <a href="/login" className="block text-center text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Log in to request a booking</a>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Service</label>
            <select value={serviceId} onChange={e => { setServiceId(e.target.value); setSlot('') }} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400">
              {config.services.map(s => <option key={s.id} value={s.id}>{s.name}{s.duration_minutes ? ` · ${s.duration_minutes >= 60 ? `${s.duration_minutes / 60}h` : `${s.duration_minutes}m`}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" min={minDate} value={date} onChange={e => { setDate(e.target.value); setSlot('') }} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" />
            {isBlocked && <p className="text-xs text-red-500 mt-1">Unavailable on that date — please pick another.</p>}
            {!isWorkDay && !isBlocked && <p className="text-xs text-red-500 mt-1">Not a working day — please pick another.</p>}
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

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Anything the professional should know" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={submit} disabled={busy || isBlocked || !isWorkDay} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
            {busy ? 'Sending…' : 'Request booking'}
          </button>
        </div>
      )}
    </div>
  )
}
