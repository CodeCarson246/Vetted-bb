'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const STATUS = {
  pending: { label: 'Awaiting confirmation', dot: '#F9C000', bg: 'rgba(249,192,0,0.15)', text: '#B45309' },
  confirmed: { label: 'Confirmed', dot: '#16a34a', bg: 'rgba(22,163,74,0.12)', text: '#16a34a' },
  declined: { label: 'Declined', dot: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '#dc2626' },
}

function fmtTime(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function BookingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('appointments')
      .select('id, title, date, start_time, duration_min, status, notes, freelancer_id, freelancers(id, name, company_name, trade, avatar_url)')
      .eq('client_user_id', user.id)
      .order('date', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; setBookings runs after the await, not synchronously
    load()
  }, [user, authLoading, router, load])

  async function cancelBooking(id) {
    setBusyId(id)
    setConfirmCancel(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/booking-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ appointment_id: id }),
    })
    setBusyId(null)
    if (res.ok) setBookings(prev => prev.filter(b => b.id !== id))
  }

  if (authLoading || loading) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const todayKey = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter(b => b.date >= todayKey && b.status !== 'declined')
  const rest = bookings.filter(b => !(b.date >= todayKey && b.status !== 'declined'))

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My bookings</h1>
          <p className="text-sm text-gray-500 mt-1">Bookings you&apos;ve requested from professionals and their status.</p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No bookings yet</p>
            <p className="text-sm text-gray-500 mb-6">When you request a booking from a professional&apos;s profile, it shows up here.</p>
            <a href="/search" className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Find a professional →</a>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {upcoming.length > 0 && <Section title="Upcoming" items={upcoming} busyId={busyId} onCancel={setConfirmCancel} />}
            {rest.length > 0 && <Section title="Past &amp; other" items={rest} busyId={busyId} onCancel={setConfirmCancel} muted />}
          </div>
        )}
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmCancel(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Cancel this request?</h3>
            <p className="text-sm text-gray-500 mb-6">This withdraws your pending booking request. The professional will be notified.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400">Keep it</button>
              <button onClick={() => cancelBooking(confirmCancel)} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#DC2626' }}>Cancel request</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Section({ title, items, busyId, onCancel, muted }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="flex flex-col gap-3">
        {items.map(b => {
          const s = STATUS[b.status] || STATUS.pending
          const f = b.freelancers
          const name = f?.company_name?.trim().length > 3 ? f.company_name : f?.name
          const d = new Date(b.date + 'T12:00:00')
          const initials = (f?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)
          return (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-5" style={{ borderLeft: `4px solid ${s.dot}`, opacity: muted ? 0.85 : 1 }}>
              <div className="flex items-start gap-4">
                <a href={`/freelancers/${f?.id}`} className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F', textDecoration: 'none' }}>
                  {f?.avatar_url ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" /> : initials}
                </a>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <a href={`/freelancers/${f?.id}`} className="font-semibold capitalize hover:underline" style={{ color: '#00267F', textDecoration: 'none' }}>{name || 'Professional'}</a>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{b.title}{f?.trade ? ` · ${f.trade}` : ''}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    {b.start_time ? ` · ${fmtTime(b.start_time)}` : ''}
                    {b.duration_min ? ` · ${b.duration_min >= 60 ? `${b.duration_min / 60}h` : `${b.duration_min}m`}` : ''}
                  </p>
                  {b.notes && <p className="text-xs text-gray-400 mt-1 italic">“{b.notes}”</p>}
                  {b.status === 'pending' && (
                    <button onClick={() => onCancel(b.id)} disabled={busyId === b.id} className="text-xs font-medium text-red-500 hover:text-red-700 mt-2 disabled:opacity-50">
                      {busyId === b.id ? 'Cancelling…' : 'Cancel request'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
