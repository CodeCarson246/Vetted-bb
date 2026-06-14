'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ICON = {
  message: '💬', reply: '💬', quote: '📄', invoice: '🧾', receipt: '✅',
  reminder: '⏰', review: '⭐', quote_accepted: '✅', quote_declined: '✖️',
  job_completed: '✅', job_paid: '💰', saved: '❤️', profile_views: '👁️', welcome: '👋',
}

const FILTERS = [
  ['all', 'All'],
  ['message', 'Messages'],
  ['quote', 'Quotes'],
  ['invoice', 'Invoices & receipts'],
  ['review', 'Reviews'],
  ['profile_views', 'Profile views'],
]

// Map a notification type onto a coarse filter bucket
function bucket(type) {
  if (type === 'message' || type === 'reply') return 'message'
  if (type === 'quote' || type === 'quote_accepted' || type === 'quote_declined') return 'quote'
  if (type === 'invoice' || type === 'receipt' || type === 'reminder' || type === 'job_paid') return 'invoice'
  if (type === 'review') return 'review'
  if (type === 'profile_views') return 'profile_views'
  return 'other'
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today - that) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return 'Earlier this week'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    load()
  }, [user, authLoading, router, load])

  const unread = items.filter(n => !n.read).length
  const filtered = filter === 'all' ? items : items.filter(n => bucket(n.type) === filter)

  async function markAllRead() {
    if (unread === 0) return
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }

  async function openItem(n) {
    if (!n.read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => {})
    }
    if (n.link) router.push(n.link)
  }

  // Group filtered items by day label, preserving recency order
  const groups = []
  for (const n of filtered) {
    const label = dayLabel(n.created_at)
    let g = groups.find(x => x.label === label)
    if (!g) { g = { label, rows: [] }; groups.push(g) }
    g.rows.push(n)
  }

  return (
    <main className="page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h1 className="text-gray-900" style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.8rem' }}>Notifications</h1>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors" style={{ borderColor: '#00267F', color: '#00267F' }}>
              Mark all read ({unread})
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 mb-6 bg-white rounded-full border border-gray-200 p-1 max-w-full overflow-x-auto no-scrollbar">
          {FILTERS.map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${filter === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
              style={filter === v ? { backgroundColor: '#00267F' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-gray-500 text-sm">{filter === 'all' ? 'No notifications yet.' : 'Nothing here for this filter.'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{group.label}</p>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {group.rows.map((n, i) => (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className="hover:bg-gray-50 w-full text-left"
                      style={{ display: 'flex', gap: 12, padding: '14px 16px', background: n.read ? 'transparent' : 'rgba(0,38,127,0.04)', border: 'none', borderTop: i > 0 ? '1px solid var(--row-stripe, #f3f4f6)' : 'none', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }} aria-hidden="true">{ICON[n.type] || '🔔'}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="text-gray-900" style={{ display: 'block', fontSize: 14, fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>{n.title}</span>
                        {n.body && <span className="text-gray-500" style={{ display: 'block', fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{n.body}</span>}
                        <span className="text-gray-400" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00267F', flexShrink: 0, marginTop: 6 }} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
