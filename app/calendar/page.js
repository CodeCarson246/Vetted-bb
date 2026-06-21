'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const STATUS = {
  confirmed: { label: 'Confirmed', dot: '#16a34a', bg: 'rgba(22,163,74,0.12)', text: '#16a34a', border: 'rgba(22,163,74,0.45)' },
  pending: { label: 'Pending', dot: '#F9C000', bg: 'rgba(249,192,0,0.16)', text: '#B45309', border: 'rgba(249,192,0,0.55)' },
  blocked: { label: 'Time off', dot: '#9CA3AF', bg: 'rgba(107,114,128,0.14)', text: '#6B7280', border: 'rgba(107,114,128,0.4)' },
}
const STATUS_KEYS = ['confirmed', 'pending', 'blocked']

const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sameDay = (a, b) => toKey(a) === toKey(b)

function fmtTime(t) {
  if (!t) return 'All day'
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`
}
function fmtDur(min) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return `${h ? `${h}h` : ''}${m ? ` ${m}m` : ''}`.trim()
}
function monthCells(cursor) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  start.setDate(1 - start.getDay())
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}
function weekDays(cursor) {
  const start = new Date(cursor)
  start.setDate(cursor.getDate() - cursor.getDay())
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

const EMPTY_FORM = { id: null, title: '', client_name: '', client_email: '', date: '', start_time: '09:00', duration_min: 60, status: 'confirmed', notes: '', quote_id: '' }

export default function CalendarPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [appts, setAppts] = useState([])
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [form, setForm] = useState(null) // null = modal closed
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const load = useCallback(async (freelancerId) => {
    const [{ data: a }, { data: q }] = await Promise.all([
      supabase.from('appointments').select('*').eq('freelancer_id', freelancerId).order('date', { ascending: true }),
      supabase.from('quotes').select('id, quote_number, invoice_number, client_name, client_email, total, status')
        .eq('freelancer_id', freelancerId).in('status', ['accepted', 'invoiced', 'completed', 'paid'])
        .order('created_at', { ascending: false }).limit(50),
    ])
    setAppts(a || [])
    setQuotes(q || [])
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    supabase.from('freelancers').select('id, name, trade').eq('user_id', user.id).maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data) { router.replace('/'); return }
        setProfile(data)
        await load(data.id)
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, authLoading, router, load])

  // ── Derived ──
  const byDate = {}
  for (const a of appts) {
    (byDate[a.date] = byDate[a.date] || []).push(a)
  }
  for (const k in byDate) byDate[k].sort((x, y) => (x.start_time || '99').localeCompare(y.start_time || '99'))

  const today = new Date()
  const todayKey = toKey(today)
  const todays = (byDate[todayKey] || [])
  const upcoming = appts
    .filter(a => a.date >= todayKey)
    .sort((a, b) => (a.date + (a.start_time || '99')).localeCompare(b.date + (b.start_time || '99')))
    .slice(0, 6)

  const weekStart = weekDays(today)[0]
  const weekEnd = weekDays(today)[6]
  const inThisWeek = a => a.date >= toKey(weekStart) && a.date <= toKey(weekEnd)
  const stats = {
    week: appts.filter(inThisWeek).length,
    confirmed: appts.filter(a => a.status === 'confirmed' && a.date >= todayKey).length,
    pending: appts.filter(a => a.status === 'pending' && a.date >= todayKey).length,
    blocked: appts.filter(a => a.status === 'blocked' && a.date >= todayKey).length,
  }

  // ── Modal actions ──
  function openNew(dateObj) {
    setForm({ ...EMPTY_FORM, date: toKey(dateObj || cursor) })
  }
  function openBlock(dateObj) {
    setForm({ ...EMPTY_FORM, date: toKey(dateObj || cursor), status: 'blocked', start_time: '' })
  }
  function openEdit(a) {
    setForm({ id: a.id, title: a.title, client_name: a.client_name || '', client_email: a.client_email || '', date: a.date, start_time: a.start_time || '', duration_min: a.duration_min || 60, status: a.status, notes: a.notes || '', quote_id: a.quote_id || '', client_user_id: a.client_user_id || null })
  }

  async function respondBooking(action) {
    if (!form.id) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/booking-respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ appointment_id: form.id, action }),
    })
    setSaving(false)
    if (!res.ok) { setToast({ msg: 'Could not update. Try again.', err: true }); return }
    const newStatus = action === 'confirm' ? 'confirmed' : 'declined'
    setAppts(prev => prev.map(a => a.id === form.id ? { ...a, status: newStatus } : a))
    setForm(null)
    setToast({ msg: action === 'confirm' ? 'Booking confirmed — client notified.' : 'Booking declined — client notified.' })
    setTimeout(() => setToast(null), 3000)
  }
  function pickQuote(qid) {
    const q = quotes.find(x => x.id === qid)
    setForm(f => ({
      ...f,
      quote_id: qid,
      title: f.title || (q ? `Job — ${q.invoice_number || q.quote_number}` : f.title),
      client_name: f.client_name || q?.client_name || '',
      client_email: f.client_email || q?.client_email || '',
    }))
  }
  async function saveAppt() {
    const isBlock = form.status === 'blocked'
    if (!isBlock && !form.title.trim()) { setToast({ msg: 'Add a title for the booking.', err: true }); return }
    setSaving(true)
    const payload = {
      freelancer_id: profile.id,
      quote_id: isBlock ? null : (form.quote_id || null),
      title: form.title.trim() || (isBlock ? 'Time off' : ''),
      client_name: form.client_name.trim() || null,
      client_email: form.client_email.trim() || null,
      date: form.date,
      start_time: form.status === 'blocked' ? (form.start_time || null) : (form.start_time || null),
      duration_min: Number(form.duration_min) || 60,
      status: form.status,
      notes: form.notes.trim() || null,
    }
    if (form.id) {
      const { data, error } = await supabase.from('appointments').update(payload).eq('id', form.id).select().single()
      if (error) { setToast({ msg: 'Could not save. Try again.', err: true }); setSaving(false); return }
      setAppts(prev => prev.map(a => a.id === form.id ? data : a))
    } else {
      const { data, error } = await supabase.from('appointments').insert(payload).select().single()
      if (error) { setToast({ msg: 'Could not save. Try again.', err: true }); setSaving(false); return }
      setAppts(prev => [...prev, data])
    }
    setSaving(false)
    setForm(null)
    setToast({ msg: isBlock ? 'Time off saved.' : 'Booking saved.' })
    setTimeout(() => setToast(null), 3000)
  }
  async function deleteAppt() {
    if (!form.id) return
    const id = form.id
    setAppts(prev => prev.filter(a => a.id !== id))
    setForm(null)
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    setToast({ msg: error ? 'Could not delete.' : 'Deleted.', err: !!error })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Navigation ──
  function shift(dir) {
    setCursor(c => {
      const d = new Date(c)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setDate(d.getDate() + dir)
      return d
    })
  }
  const rangeLabel = view === 'month'
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === 'week'
    ? (() => { const w = weekDays(cursor); return `${MONTHS[w[0].getMonth()].slice(0, 3)} ${w[0].getDate()} – ${MONTHS[w[6].getMonth()].slice(0, 3)} ${w[6].getDate()}` })()
    : cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (authLoading || loading) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Calendar &amp; availability</h1>
            <p className="text-sm text-gray-500 mt-1">Track your jobs and bookings. Block time off when you&apos;re unavailable.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openBlock(new Date())} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#9CA3AF', color: '#6B7280' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
              Block time off
            </button>
            <button onClick={() => openNew(new Date())} className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              New booking
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'This week', value: stats.week, color: '#00267F' },
            { label: 'Confirmed', value: stats.confirmed, color: '#16a34a' },
            { label: 'Pending', value: stats.pending, color: '#B45309' },
            { label: 'Blocked', value: stats.blocked, color: '#6B7280' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: c.color, fontFamily: "'Sora', sans-serif" }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-1">
                  <button onClick={() => shift(-1)} aria-label="Previous" className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></button>
                  <button onClick={() => shift(1)} aria-label="Next" className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
                  <button onClick={() => setCursor(new Date())} className="ml-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400">Today</button>
                  <span className="ml-2 font-semibold text-gray-900">{rangeLabel}</span>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-full p-1">
                  {['month', 'week', 'day'].map(v => (
                    <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${view === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`} style={view === v ? { backgroundColor: '#00267F' } : {}}>{v}</button>
                  ))}
                </div>
              </div>

              {view === 'month' && (
                <>
                  <div className="grid grid-cols-7 mb-1">
                    {DOW.map(d => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--border-card)' }}>
                    {monthCells(cursor).map((d, i) => {
                      const inMonth = d.getMonth() === cursor.getMonth()
                      const list = byDate[toKey(d)] || []
                      const isToday = sameDay(d, today)
                      return (
                        <div key={i} onClick={() => openNew(d)} className="bg-white min-h-[78px] sm:min-h-[92px] p-1.5 cursor-pointer hover:bg-gray-50 transition-colors" style={{ opacity: inMonth ? 1 : 0.45 }}>
                          <div className="flex justify-center sm:justify-end">
                            <span className={`text-xs ${isToday ? 'text-white font-bold' : 'text-gray-500'}`} style={isToday ? { backgroundColor: '#00267F', borderRadius: 999, width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}}>{d.getDate()}</span>
                          </div>
                          <div className="mt-1 flex flex-col gap-1">
                            {list.slice(0, 3).map(a => {
                              const s = STATUS[a.status] || STATUS.confirmed
                              return (
                                <button key={a.id} onClick={e => { e.stopPropagation(); openEdit(a) }} className="text-left rounded-md px-1.5 py-0.5 truncate" style={{ backgroundColor: s.bg, color: s.text, fontSize: '0.66rem', fontWeight: 600, borderLeft: `2px solid ${s.dot}` }}>
                                  {a.start_time ? `${fmtTime(a.start_time).replace(':00', '')} ` : ''}{a.title}
                                </button>
                              )
                            })}
                            {list.length > 3 && <span className="text-[0.62rem] text-gray-400 pl-1">+{list.length - 3} more</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {view === 'week' && (
                <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                  {weekDays(cursor).map((d, i) => {
                    const list = byDate[toKey(d)] || []
                    const isToday = sameDay(d, today)
                    return (
                      <div key={i} className="rounded-xl border border-gray-100 p-2 min-h-[120px]">
                        <div onClick={() => openNew(d)} className="flex items-center justify-between mb-2 cursor-pointer">
                          <span className="text-xs font-semibold text-gray-400">{DOW[d.getDay()]}</span>
                          <span className={`text-xs ${isToday ? 'text-white font-bold' : 'text-gray-600'}`} style={isToday ? { backgroundColor: '#00267F', borderRadius: 999, width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}}>{d.getDate()}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {list.map(a => <ApptChip key={a.id} a={a} onClick={() => openEdit(a)} />)}
                          {list.length === 0 && <button onClick={() => openNew(d)} className="text-[0.66rem] text-gray-300 hover:text-gray-500 text-left">+ add</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {view === 'day' && (
                <div className="flex flex-col gap-2">
                  {(byDate[toKey(cursor)] || []).length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400 mb-3">Nothing scheduled for this day.</p>
                      <button onClick={() => openNew(cursor)} className="text-sm font-semibold px-4 py-2 rounded-full text-white" style={{ backgroundColor: '#00267F' }}>+ Add booking</button>
                    </div>
                  ) : (byDate[toKey(cursor)] || []).map(a => <ApptRow key={a.id} a={a} onClick={() => openEdit(a)} />)}
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                {STATUS_KEYS.map(k => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <span style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: STATUS[k].dot }} />{STATUS[k].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Today&apos;s schedule</h2>
              {todays.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing booked today.</p>
              ) : (
                <div className="flex flex-col gap-2">{todays.map(a => <ApptRow key={a.id} a={a} compact onClick={() => openEdit(a)} />)}</div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">Nothing coming up. Add your first booking.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map(a => {
                    const s = STATUS[a.status] || STATUS.confirmed
                    const d = new Date(a.date + 'T12:00:00')
                    return (
                      <button key={a.id} onClick={() => openEdit(a)} className="flex items-start gap-3 text-left w-full">
                        <span className="mt-1.5 flex-shrink-0" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: s.dot }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-900 truncate">{a.title}</span>
                          <span className="block text-xs text-gray-400">{d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{a.start_time ? ` · ${fmtTime(a.start_time)}` : ''}{a.client_name ? ` · ${a.client_name}` : ''}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / edit modal */}
      {form && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setForm(null)}>
          {(() => { const isBlock = form.status === 'blocked'; return (
          <div className="bg-white rounded-2xl w-full max-w-md p-6 my-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-4">{form.id ? (isBlock ? 'Edit time off' : 'Edit booking') : (isBlock ? 'Block time off' : 'New booking')}</h3>
            <div className="flex flex-col gap-3">
              {quotes.length > 0 && !form.id && !isBlock && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Link to a job (optional)</label>
                  <select value={form.quote_id} onChange={e => pickQuote(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400">
                    <option value="">— None —</option>
                    {quotes.map(q => <option key={q.id} value={q.id}>{q.invoice_number || q.quote_number} · {q.client_name || 'Client'}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Linking a job is just for your records — it doesn&apos;t change your public availability.</p>
                </div>
              )}
              <Field label={isBlock ? 'Label (optional)' : 'Title'}>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={isBlock ? 'e.g. Vacation (optional)' : 'e.g. Panel upgrade'} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {!isBlock && <Field label="Client name"><input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" /></Field>}
                <Field label="Type">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400">
                    {STATUS_KEYS.map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date"><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" /></Field>
                <Field label="Time"><input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400" /></Field>
                <Field label="Duration">
                  <select value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400">
                    {[30, 60, 90, 120, 180, 240, 480].map(m => <option key={m} value={m}>{fmtDur(m)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes (optional)"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400 resize-none" /></Field>
            </div>

            {form.id && form.client_user_id && form.status === 'pending' && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-xl" style={{ backgroundColor: 'rgba(249,192,0,0.12)' }}>
                <span className="text-xs font-medium flex-1" style={{ color: '#B45309' }}>Client booking request — confirm or decline.</span>
                <button onClick={() => respondBooking('decline')} disabled={saving} className="text-xs font-semibold px-3.5 py-2 rounded-full border border-gray-300 text-gray-600 hover:border-gray-500 disabled:opacity-50">Decline</button>
                <button onClick={() => respondBooking('confirm')} disabled={saving} className="text-xs font-semibold px-3.5 py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>Confirm</button>
              </div>
            )}

            <div className="flex items-center gap-3 mt-5">
              {form.id && <button onClick={deleteAppt} className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>}
              <div className="flex-1" />
              <button onClick={() => setForm(null)} className="text-sm font-medium px-4 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400">Cancel</button>
              <button onClick={saveAppt} disabled={saving} className="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
          ) })()}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg`} style={{ backgroundColor: toast.err ? '#DC2626' : '#00267F' }}>{toast.msg}</div>
      )}
    </main>
  )
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>{children}</div>
}

function ApptChip({ a, onClick }) {
  const s = STATUS[a.status] || STATUS.confirmed
  return (
    <button onClick={onClick} className="text-left rounded-md px-1.5 py-1 truncate w-full" style={{ backgroundColor: s.bg, color: s.text, fontSize: '0.68rem', fontWeight: 600, borderLeft: `2px solid ${s.dot}` }}>
      {a.start_time ? `${fmtTime(a.start_time)} · ` : ''}{a.title}
    </button>
  )
}

function ApptRow({ a, onClick, compact }) {
  const s = STATUS[a.status] || STATUS.confirmed
  return (
    <button onClick={onClick} className="flex items-center gap-3 text-left w-full rounded-xl p-2.5 hover:bg-gray-50 transition-colors" style={{ border: '1px solid var(--border-card)' }}>
      <span className="flex-shrink-0 text-center" style={{ minWidth: 56 }}>
        <span className="block text-xs font-bold text-gray-900">{a.start_time ? fmtTime(a.start_time) : 'All day'}</span>
        {!compact && a.duration_min ? <span className="block text-[0.62rem] text-gray-400">{fmtDur(a.duration_min)}</span> : null}
      </span>
      <span className="flex-1 min-w-0" style={{ borderLeft: `3px solid ${s.dot}`, paddingLeft: 10 }}>
        <span className="block text-sm font-medium text-gray-900 truncate">{a.title}</span>
        {a.client_name && <span className="block text-xs text-gray-400 truncate">{a.client_name}</span>}
      </span>
      <span className="flex-shrink-0 text-[0.66rem] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
    </button>
  )
}
