'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ICON = {
  message: '💬', reply: '💬', quote: '📄', invoice: '🧾', receipt: '✅',
  reminder: '⏰', review: '⭐', quote_accepted: '✅', quote_declined: '✖️',
  job_completed: '✅', job_paid: '💰', saved: '❤️', profile_views: '👁️', welcome: '👋',
  saved_search: '🔍', booking_request: '📅', booking_confirmed: '✅', booking_declined: '✖️',
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const router = useRouter()
  const { user } = useAuth()
  // Key effects on the stable user id, not the user object — auth refreshes
  // hand back a new object with the same id, and re-subscribing the realtime
  // channel on every such change caused constant CLOSED/re-subscribe churn.
  const uid = user?.id
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const unread = items.filter(n => !n.read).length

  const load = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setItems(data || [])
  }, [uid])

  // Initial load + once-a-day profile-view digest sync
  useEffect(() => {
    if (!uid) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; setItems runs after the await, not synchronously
    load()
    const key = `pvsync:${uid}:${new Date().toISOString().slice(0, 10)}`
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (token) {
          fetch('/api/notifications/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            .then(() => load())
            .catch(() => {})
        }
      })
    }
  }, [uid, load])

  // Realtime: new notifications for me appear instantly
  useEffect(() => {
    if (!uid) return
    // Unique channel name per subscription — a stable name collides with the
    // not-yet-torn-down old channel on re-subscribe (setAuth rejoin), which
    // Realtime reports as "mismatch between server and client bindings".
    const channel = supabase
      .channel(`notif-${uid}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        payload => {
          if (payload.eventType === 'INSERT') setItems(prev => [payload.new, ...prev].slice(0, 20))
          else load() // update (read toggled) / delete elsewhere → resync
        })
      .subscribe((status, err) => {
        // Only flag real failures. CLOSED/CLOSING are normal on teardown, and
        // SUBSCRIBED is success — don't log those.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[notif] realtime status:', status, err?.message || err || '')
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [uid, load])

  // Fallback poll + tab-focus refresh, so the badge still updates within ~12s
  // even if realtime is unavailable on the connection.
  useEffect(() => {
    if (!uid) return
    const id = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') load()
    }, 12000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [uid, load])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const onClick = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markAllRead() {
    if (unread === 0) return
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }

  async function openItem(n) {
    setOpen(false)
    if (!n.read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => {})
    }
    if (n.link) router.push(n.link)
  }

  if (!user) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#00267F')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="bg-white notif-dropdown"
          style={{ borderRadius: 14, border: '1px solid var(--border-card, #e5e7eb)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 200 }}
        >
          <div className="border-b border-gray-100" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="text-gray-900" style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 12, fontWeight: 600, color: '#00267F', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <p className="text-gray-400" style={{ fontSize: 13, textAlign: 'center', padding: '28px 16px' }}>No notifications yet.</p>
            ) : (
              items.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="hover:bg-gray-50 border-b border-gray-50"
                  style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '12px 16px', background: n.read ? 'transparent' : 'rgba(0,38,127,0.04)', border: 'none', borderBottom: '1px solid var(--row-stripe, #f3f4f6)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }} aria-hidden="true">{ICON[n.type] || '🔔'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="text-gray-900" style={{ display: 'block', fontSize: 13, fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>{n.title}</span>
                    {n.body && <span className="text-gray-500" style={{ display: 'block', fontSize: 12, lineHeight: 1.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</span>}
                    <span className="text-gray-400" style={{ display: 'block', fontSize: 11, marginTop: 3 }}>{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00267F', flexShrink: 0, marginTop: 5 }} />}
                </button>
              ))
            )}
          </div>

          <a
            href="/notifications"
            onClick={() => setOpen(false)}
            className="border-t border-gray-100 hover:bg-gray-50"
            style={{ display: 'block', textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#00267F', textDecoration: 'none' }}
          >
            See all notifications →
          </a>
        </div>
      )}
    </div>
  )
}
