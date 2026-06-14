'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ICON = {
  message: '💬', reply: '💬', quote: '📄', invoice: '🧾', receipt: '✅',
  reminder: '⏰', review: '⭐', quote_accepted: '✅', quote_declined: '✖️',
  job_completed: '✅', job_paid: '💰', saved: '❤️', profile_views: '👁️', welcome: '👋',
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
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const unread = items.filter(n => !n.read).length

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setItems(data || [])
  }, [user])

  // Initial load + once-a-day profile-view digest sync
  useEffect(() => {
    if (!user) return
    load()
    const key = `pvsync:${user.id}:${new Date().toISOString().slice(0, 10)}`
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
  }, [user, load])

  // Realtime: new notifications for me appear instantly
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        payload => setItems(prev => [payload.new, ...prev].slice(0, 20)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

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
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#00267F' }}
        className="nav-auth-link"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, backgroundColor: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="bg-white"
          style={{ position: 'absolute', right: 0, top: 48, width: 340, maxWidth: '90vw', borderRadius: 14, border: '1px solid var(--border-card, #e5e7eb)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 100 }}
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
