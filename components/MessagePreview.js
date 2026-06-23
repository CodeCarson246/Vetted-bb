'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function preview(text) {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').slice(0, 80)
}

export default function MessagePreview({ freelancerProfile, unreadCount }) {
  const router = useRouter()
  const { user } = useAuth()
  const uid = user?.id
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState([])
  const wrapRef = useRef(null)
  const isFreelancer = !!freelancerProfile

  const load = useCallback(async () => {
    if (!uid) return

    if (isFreelancer) {
      // Freelancer: threads addressed to them, enriched with latest reply
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, subject, sender_name, sender_email, read, created_at, message')
        .eq('freelancer_id', freelancerProfile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!msgs?.length) { setThreads([]); return }

      const { data: replies } = await supabase
        .from('message_replies')
        .select('message_id, body, created_at, sender_user_id')
        .in('message_id', msgs.map(m => m.id))
        .order('created_at', { ascending: false })

      const latestReply = {}
      for (const r of replies || []) {
        if (!latestReply[r.message_id]) latestReply[r.message_id] = r
      }

      setThreads(
        msgs
          .map(m => {
            const last = latestReply[m.id]
            return {
              id: m.id,
              name: m.sender_name || m.sender_email || 'Client',
              previewText: preview(last?.body || m.message),
              at: last?.created_at || m.created_at,
              unread: !m.read,
              link: '/inbox',
            }
          })
          .sort((a, b) => new Date(b.at) - new Date(a.at))
          .slice(0, 6)
      )
    } else {
      // Client: threads they started, enriched with latest reply
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, subject, client_read, created_at, message, freelancer_id, freelancers(name, company_name, avatar_url)')
        .eq('sender_user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!msgs?.length) { setThreads([]); return }

      const { data: replies } = await supabase
        .from('message_replies')
        .select('message_id, body, created_at, sender_user_id')
        .in('message_id', msgs.map(m => m.id))
        .order('created_at', { ascending: false })

      const latestReply = {}
      for (const r of replies || []) {
        if (!latestReply[r.message_id]) latestReply[r.message_id] = r
      }

      setThreads(
        msgs
          .map(m => {
            const f = m.freelancers
            const last = latestReply[m.id]
            return {
              id: m.id,
              name: f?.company_name?.trim().length > 3 ? f.company_name : f?.name || 'Professional',
              previewText: preview(last?.body || m.message),
              at: last?.created_at || m.created_at,
              unread: !m.client_read,
              link: '/messages',
            }
          })
          .sort((a, b) => new Date(b.at) - new Date(a.at))
          .slice(0, 6)
      )
    }
  }, [uid, isFreelancer, freelancerProfile?.id])

  // Load on open
  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Realtime: refresh when a message or reply changes
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`msg-preview-${uid}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { if (open) load() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_replies' }, () => { if (open) load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [uid, open, load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const destination = isFreelancer ? '/inbox' : '/messages'

  if (!user) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Messages"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#00267F')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="bg-white notif-dropdown"
          style={{ borderRadius: 14, border: '1px solid var(--border-card, #e5e7eb)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 200 }}
        >
          <div className="border-b border-gray-100" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span className="text-gray-900" style={{ fontWeight: 600, fontSize: 14 }}>Messages</span>
            <Link href={destination} onClick={() => setOpen(false)} style={{ fontSize: 12, fontWeight: 600, color: '#00267F', textDecoration: 'none' }}>Open inbox →</Link>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {threads.length === 0 ? (
              <p className="text-gray-400" style={{ fontSize: 13, textAlign: 'center', padding: '28px 16px' }}>No messages yet.</p>
            ) : (
              threads.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setOpen(false); router.push(destination) }}
                  style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '12px 16px', background: t.unread ? 'rgba(0,38,127,0.04)' : 'transparent', border: 'none', borderBottom: '1px solid var(--row-stripe, #f3f4f6)', cursor: 'pointer' }}
                  className="hover:bg-gray-50"
                >
                  {/* Avatar initial */}
                  <span style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#00267F', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(t.name || '?')[0].toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span className="text-gray-900" style={{ fontSize: 13, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span className="text-gray-400" style={{ fontSize: 11, flexShrink: 0 }}>{timeAgo(t.at)}</span>
                    </span>
                    {t.previewText && (
                      <span className="text-gray-500" style={{ display: 'block', fontSize: 12, lineHeight: 1.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.previewText}</span>
                    )}
                  </span>
                  {t.unread && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00267F', flexShrink: 0, marginTop: 6 }} />}
                </button>
              ))
            )}
          </div>

          <Link
            href={destination}
            onClick={() => setOpen(false)}
            className="border-t border-gray-100 hover:bg-gray-50"
            style={{ display: 'block', textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#00267F', textDecoration: 'none' }}
          >
            See all messages →
          </Link>
        </div>
      )}
    </div>
  )
}
