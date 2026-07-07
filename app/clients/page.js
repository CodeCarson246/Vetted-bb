'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const DAY = 86400000
const norm = s => (s || '').trim().toLowerCase()

export default function ClientsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [clients, setClients] = useState([])
  const [openJobs, setOpenJobs] = useState(0)
  const [clock, setClock] = useState({ now: 0, som: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all') // all | returning | new

  const load = useCallback(async (fid) => {
    const [{ data: msgs }, { data: quotes }, { data: appts }] = await Promise.all([
      supabase.from('messages').select('sender_name, sender_email, sender_user_id, created_at').eq('freelancer_id', fid),
      supabase.from('quotes').select('client_name, client_email, status, total, paid_at, created_at').eq('freelancer_id', fid),
      supabase.from('appointments').select('client_name, client_email, client_user_id, status, date, created_at').eq('freelancer_id', fid).not('client_user_id', 'is', null),
    ])

    const map = {}
    const touch = (name, email, dateStr) => {
      const key = norm(email) || norm(name)
      if (!key) return null
      const t = dateStr ? new Date(dateStr).getTime() : Date.now()
      if (!map[key]) map[key] = { key, name: name || email || 'Client', email: email || '', first: t, last: t, jobs: 0, spend: 0 }
      const c = map[key]
      if (name && (!c.name || c.name === c.email)) c.name = name
      if (email && !c.email) c.email = email
      c.first = Math.min(c.first, t); c.last = Math.max(c.last, t)
      return c
    }

    for (const m of msgs || []) touch(m.sender_name, m.sender_email, m.created_at)
    let open = 0
    for (const q of quotes || []) {
      const c = touch(q.client_name, q.client_email, q.paid_at || q.created_at)
      if (q.status === 'paid') { if (c) { c.jobs += 1; c.spend += Number(q.total) || 0 } }
      if (['accepted', 'invoiced', 'completed'].includes(q.status)) open += 1
    }
    for (const a of appts || []) touch(a.client_name, a.client_email, a.date ? a.date + 'T12:00:00' : a.created_at)

    setClients(Object.values(map).sort((a, b) => b.last - a.last))
    setOpenJobs(open)
    const d = new Date()
    setClock({ now: Date.now(), som: new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    supabase.from('freelancers').select('id, name').eq('user_id', user.id).maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data) { router.replace('/'); return }
        setProfile(data)
        await load(data.id)
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, authLoading, router, load])

  if (authLoading || loading) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const { now, som: startOfMonth } = clock
  const total = clients.length
  const returning = clients.filter(c => c.jobs >= 2).length
  const newThisMonth = clients.filter(c => c.first >= startOfMonth).length
  const isActive = c => now - c.last <= 90 * DAY

  const filtered = clients.filter(c => {
    if (tab === 'returning' && c.jobs < 2) return false
    if (tab === 'new' && c.first < startOfMonth) return false
    if (search.trim()) { const q = search.toLowerCase(); return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) }
    return true
  })

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-1">Everyone who has messaged, hired or booked you.</p>
          </div>
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-full text-sm text-gray-900 bg-white outline-none focus:border-gray-400 w-full sm:w-64" />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" /></svg>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Total clients', value: total },
            { label: 'Returning clients', value: returning, sub: total ? `${Math.round((returning / total) * 100)}% of total` : '' },
            { label: 'New this month', value: newThisMonth },
            { label: 'Active jobs', value: openJobs, sub: 'open quotes & invoices' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{c.value}</p>
              {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
            </div>
          ))}
        </div>

        {total === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No clients yet</p>
            <p className="text-sm text-gray-500">As people message, hire or book you, they&apos;ll be collected here automatically.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex gap-1 px-4 sm:px-5 pt-4">
              {[['all', 'All clients'], ['returning', 'Returning'], ['new', 'New']].map(([v, label]) => (
                <button key={v} onClick={() => setTab(v)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${tab === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`} style={tab === v ? { backgroundColor: '#00267F' } : {}}>{label}</button>
              ))}
            </div>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="font-semibold px-4 sm:px-5 py-3">Client</th>
                    <th className="font-semibold px-3 py-3">Contact</th>
                    <th className="font-semibold px-3 py-3">Last seen</th>
                    <th className="font-semibold px-3 py-3 text-center">Jobs</th>
                    <th className="font-semibold px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const active = isActive(c)
                    return (
                      <tr key={c.key} className="border-b border-gray-50">
                        <td className="px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                              {(c.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 capitalize truncate">{c.name}</p>
                              {c.spend > 0 && <p className="text-xs text-gray-400">${c.spend.toFixed(0)} earned</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 truncate max-w-[200px]">{c.email || ''}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{new Date(c.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-3 py-3 text-center font-semibold text-gray-900">{c.jobs}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={active ? { backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a' } : { backgroundColor: 'var(--row-stripe)', color: '#6B7280' }}>{active ? 'Active' : 'Inactive'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 px-5 py-3 border-t border-gray-50">Showing {filtered.length} of {total} client{total === 1 ? '' : 's'} · phone numbers aren’t collected on Vetted</p>
          </div>
        )}
      </div>
    </main>
  )
}
