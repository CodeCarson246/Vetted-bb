'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuoteId, dedupeThreadReplies, conversationPreview, isReceiptBody } from '@/lib/quoteReply'
import { printSavedQuote } from '@/lib/printQuote'
import { formatDocDate } from '@/lib/formatDate'
import { useRealtimeThreads } from '@/lib/useRealtimeThreads'
import { uploadChatPhoto } from '@/lib/uploadChatPhoto'
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge'
import ReceiptLineCard from '@/components/ReceiptLineCard'

function EnvelopeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

export default function ClientMessages() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [replies, setReplies] = useState({})
  const [quotes, setQuotes] = useState({})
  const [viewingQuote, setViewingQuote] = useState(null)
  const [newReplies, setNewReplies] = useState({})
  const [myReviews, setMyReviews] = useState([])
  const [myClientProfile, setMyClientProfile] = useState(null)
  const [toast, setToast] = useState(null)
  const threadEndRef = useRef(null)

  // Opening a thread (or sending into it) scrolls the newest message
  // and composer into view — read the latest first, scroll up for history
  const expandedReplyCount = expandedId ? (replies[expandedId] || []).length : 0
  // Quote/invoice/receipt cards load lazily after expand; re-scroll once
  // they resolve so the thread lands fully at the bottom, not short.
  const expandedQuotesLoaded = expandedId
    ? (replies[expandedId] || []).map(getQuoteId).filter(Boolean).filter(qid => quotes[qid]).length
    : 0
  useEffect(() => {
    if (!expandedId) return
    const scroll = () => threadEndRef.current?.scrollIntoView({ block: 'end' })
    // Instant (not smooth) so layout shifts from late-loading cards/images
    // don't leave it short; a second pass catches that late layout.
    const t1 = setTimeout(scroll, 60)
    const t2 = setTimeout(scroll, 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [expandedId, expandedReplyCount, expandedQuotesLoaded])
  const [respondingQuoteId, setRespondingQuoteId] = useState(null)
  const [replySending, setReplySending] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null)
  const [deletingThread, setDeletingThread] = useState(false)

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }
  const [replyPhoto, setReplyPhoto] = useState(null) // { url } for the open thread
  const [photoUploading, setPhotoUploading] = useState(false)

  async function attachReplyPhoto(file) {
    if (!file) return
    setPhotoUploading(true)
    const { url, error } = await uploadChatPhoto(file, user.id)
    if (error) setToast({ message: error, type: 'error' })
    else setReplyPhoto({ url })
    setPhotoUploading(false)
    setTimeout(() => setToast(null), 4000)
  }

  async function sendReply(msg) {
    const text = (newReplies[msg.id] || '').trim()
    const imageUrl = replyPhoto?.url || null
    if (!text && !imageUrl) return
    setReplySending(true)
    const senderName = user.user_metadata?.full_name || user.email.split('@')[0]
    const { data, error } = await supabase
      .from('message_replies')
      .insert({
        message_id: msg.id,
        sender_name: senderName,
        sender_user_id: user.id,
        body: text,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (error) {
      setToast({ message: 'Could not send your reply. Please try again.', type: 'error' })
    } else {
      setReplies(prev => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), data] }))
      setNewReplies(prev => ({ ...prev, [msg.id]: '' }))
      setReplyPhoto(null)
      // Resurface the thread as unread in the freelancer's inbox
      supabase.from('messages').update({ read: false }).eq('id', msg.id).then(() => {})
      // Email + push notification to the freelancer (fire-and-forget)
      fetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freelancer_id: msg.freelancers?.id || msg.freelancer_id,
          senderName,
          senderEmail: user.email,
          subject: `Re: ${msg.subject || 'your conversation'}`,
          message: text || '📷 Photo',
        }),
      }).catch(() => {})
    }
    setReplySending(false)
    setTimeout(() => setToast(null), 4000)
  }

  async function respondToQuote(quoteId, status) {
    setRespondingQuoteId(quoteId)
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId)
    if (error) {
      setToast({ message: 'Could not update the quote. Please try again.', type: 'error' })
    } else {
      setQuotes(prev => ({ ...prev, [quoteId]: { ...prev[quoteId], status } }))
      // Notify the freelancer (fire-and-forget)
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (token) fetch('/api/notify-quote-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quote_id: quoteId, event: status === 'accepted' ? 'accepted' : 'declined' }),
        }).catch(() => {})
      })
      setToast({
        message: status === 'accepted' ? 'Quote accepted — the freelancer has been notified.' : 'Quote declined.',
        type: 'success',
      })
    }
    setRespondingQuoteId(null)
    setTimeout(() => setToast(null), 4000)
  }

  const { user: authUser, loading: authLoading } = useAuth()

  // Pull the thread list + every thread's replies, enrich previews and sort
  // by latest activity. Shared by the initial load and the live-refresh poll.
  async function loadThreads(u) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, freelancers(id, name, avatar_url, trade, company_name, email, location, verified, phone_verified)')
      .eq('sender_email', u.email)
      .order('created_at', { ascending: false })

    const list = msgs || []
    const byThread = {}
    if (list.length > 0) {
      const { data: allReplies } = await supabase
        .from('message_replies')
        .select('*')
        .in('message_id', list.map(m => m.id))
        .order('created_at', { ascending: true })

      for (const r of allReplies || []) {
        if (!byThread[r.message_id]) byThread[r.message_id] = []
        byThread[r.message_id].push(r)
      }

      const enriched = list
        .map(m => {
          const thread = byThread[m.id] || []
          const last = thread[thread.length - 1]
          return {
            ...m,
            last_activity_at: last?.created_at || m.created_at,
            latest_preview: last ? conversationPreview(last, u.id) : m.message,
          }
        })
        .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
      setReplies(byThread)
      setMessages(enriched)
    } else {
      setReplies({})
      setMessages([])
    }
    return byThread
  }

  useEffect(() => {
    if (authLoading) return
    async function init() {
      const u = authUser
      if (!u) { router.push('/login'); return }
      setUser(u)
      await loadThreads(u)

      const { data: revs } = await supabase
        .from('reviews')
        .select('*, freelancers(id, name)')
        .eq('author_user_id', u.id)
        .order('date', { ascending: false })
      setMyReviews(revs || [])

      // Own client profile — used for the "You" avatars in threads
      const { data: cp } = await supabase
        .from('client_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', u.id)
        .maybeSingle()
      setMyClientProfile(cp || null)

      setLoading(false)
    }
    init()
  }, [authUser, authLoading, router])

  // Re-pull threads (and the open thread's quotes) so a conversation updates
  // while you sit on the page — new replies, quotes, invoices and receipts
  // appear without a manual reload. Driven by Supabase Realtime (instant),
  // with a slow interval + tab-focus refresh as a safety net.
  async function refresh() {
    if (!user) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const byThread = await loadThreads(user)
    if (expandedId && byThread[expandedId]) {
      const quoteIds = byThread[expandedId].map(getQuoteId).filter(Boolean)
      if (quoteIds.length > 0) {
        const { data: qs } = await supabase.from('quotes').select('*').in('id', quoteIds)
        if (qs) setQuotes(prev => ({ ...prev, ...Object.fromEntries(qs.map(q => [q.id, q])) }))
      }
    }
  }

  useRealtimeThreads(!!user, refresh)

  // Safety-net poll (covers the case where realtime isn't enabled / drops).
  useEffect(() => {
    if (!user) return
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [user, expandedId])

  async function handleExpand(msg) {
    if (expandedId === msg.id) { setExpandedId(null); return }
    setExpandedId(msg.id)

    // Opening the thread clears the unread badge for this client
    if (msg.client_read === false) {
      supabase.from('messages').update({ client_read: true }).eq('id', msg.id).then(() => {})
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, client_read: true } : m))
    }

    const r = replies[msg.id] || []
    const quoteIds = r.map(getQuoteId).filter(Boolean)
    if (quoteIds.length > 0) {
      const { data: qs } = await supabase
        .from('quotes')
        .select('*')
        .in('id', quoteIds)
      if (qs) {
        const map = {}
        qs.forEach(q => { map[q.id] = q })
        setQuotes(prev => ({ ...prev, ...map }))
      }
    }
  }

  function hasNewActivity(msg) {
    return (replies[msg.id] || []).length > 0
  }

  async function deleteConversations(msgs) {
    setDeletingThread(true)
    setDeleteConfirmMsg(null)
    const ids = msgs.map(m => m.id)
    setMessages(prev => prev.filter(m => !ids.includes(m.id)))
    if (ids.includes(expandedId)) setExpandedId(null)
    exitSelectMode()

    await supabase.from('quotes').delete().in('message_id', ids)
    await supabase.from('message_replies').delete().in('message_id', ids)
    const { error } = await supabase.from('messages').delete().in('id', ids)

    if (error) {
      setMessages(prev =>
        [...prev, ...msgs].sort((a, b) =>
          new Date(b.last_activity_at || b.created_at) - new Date(a.last_activity_at || a.created_at)
        )
      )
      setToast({ message: 'Failed to delete. Please try again.', type: 'error' })
    } else {
      setToast({ message: msgs.length === 1 ? 'Conversation deleted' : `${msgs.length} conversations deleted`, type: 'success' })
    }
    setDeletingThread(false)
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDeleteReview(reviewId) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('author_user_id', user.id)
    if (error) {
      setToast({ message: 'Failed to delete review. Please try again.', type: 'error' })
    } else {
      setMyReviews(prev => prev.filter(r => r.id !== reviewId))
      setToast({ message: 'Your review has been removed.', type: 'success' })
    }
    setTimeout(() => setToast(null), 4000)
  }

  // ── Conversation pane (middle column) ─────────────────────────────
  function renderConversation(msg) {
    const f = msg.freelancers
    const fmtTime = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return (
      <>
        {/* Conversation header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <button onClick={() => setExpandedId(null)} className="md:hidden text-gray-500 p-1 -ml-1" aria-label="Back to list">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <a href={`/freelancers/${f?.id}`} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold overflow-hidden flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
            {f?.avatar_url ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" /> : (f?.name || '?').split(' ').map(n => n[0]).join('')}
          </a>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">{f?.name}{isVerified(f) && <VerifiedBadge size={13} />}</p>
            <p className="text-xs text-gray-400 truncate">{msg.subject}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 min-h-0">
          {/* Original enquiry (you → right) */}
          <div className="flex justify-end">
            <div className="max-w-[80%]">
              <div className="rounded-2xl rounded-tr-md px-4 py-2.5 text-white" style={{ backgroundColor: '#00267F' }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 mr-1 text-right">{fmtTime(msg.created_at)}</p>
            </div>
          </div>

          {dedupeThreadReplies(replies[msg.id] || [], quotes).map(r => {
            const quoteId = getQuoteId(r)
            const quoteData = quoteId ? (quotes[quoteId] || null) : null
            if (quoteId && quoteData) {
              const asReceipt = (r.body || '').startsWith('Sent receipt')
              const asInvoice = asReceipt || ((r.body || '').startsWith('Sent invoice') && !!quoteData.invoice_number)
              const dueDate = asInvoice ? (quoteData.invoice_due_date || quoteData.due_date) : quoteData.due_date
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: asReceipt ? '#166534' : '#00267F' }}>
                    <div>
                      <p className="text-white font-semibold text-sm">{asReceipt ? `Receipt ${quoteData.invoice_number}` : asInvoice ? `Invoice ${quoteData.invoice_number}` : `Quote ${quoteData.quote_number}`}</p>
                      <p className="text-xs mt-0.5" style={{ color: asReceipt ? '#86efac' : '#93b8ff' }}>
                        From {f?.name} · {formatDocDate((asInvoice ? quoteData.invoiced_at : quoteData.quote_date) || quoteData.quote_date)}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingQuote({ quote: quoteData, freelancer: f, asInvoice, asReceipt })}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                    >
                      View &amp; download
                    </button>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(quoteData.total).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{asReceipt ? 'Paid' : 'Payment due'}</p>
                        <p className="text-sm font-semibold" style={{ color: asReceipt ? '#166534' : '#374151' }}>{asReceipt
                          ? (quoteData.paid_at ? formatDocDate(quoteData.paid_at) : '—')
                          : (dueDate ? formatDocDate(dueDate) : '—')}</p>
                      </div>
                    </div>
                    {quoteData.status === 'sent' ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => respondToQuote(quoteData.id, 'accepted')} disabled={respondingQuoteId === quoteData.id} className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>
                          Accept
                        </button>
                        <button onClick={() => respondToQuote(quoteData.id, 'declined')} disabled={respondingQuoteId === quoteData.id} className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-300 text-gray-600 hover:border-gray-500 transition-colors disabled:opacity-50">
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
                        accepted: { backgroundColor: '#DCFCE7', color: '#166534' },
                        declined: { backgroundColor: '#FEE2E2', color: '#991B1B' },
                        invoiced: { backgroundColor: '#FEF3C7', color: '#92400E' },
                        completed: { backgroundColor: '#E0E7FF', color: '#3730A3' },
                        paid: { backgroundColor: '#DCFCE7', color: '#166534' },
                      }[quoteData.status] || { backgroundColor: '#EEF2FF', color: '#00267F' }}>
                        {{
                          accepted: 'Accepted',
                          declined: 'Declined',
                          invoiced: `Invoice — due ${quoteData.invoice_due_date ? formatDocDate(quoteData.invoice_due_date, { day: 'numeric', month: 'short' }) : 'soon'}`,
                          completed: 'Job completed',
                          paid: 'Paid ✓',
                        }[quoteData.status] || quoteData.status}
                      </span>
                    )}
                  </div>
                </div>
              )
            }
            if (quoteId && !quoteData) return null
            if (isReceiptBody(r.body)) {
              return <div key={r.id}><ReceiptLineCard body={r.body} fromName={f?.name} /></div>
            }
            const isOwn = r.sender_user_id === user?.id
            if (r._deleted) {
              return <div key={r.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}><p className="text-xs italic text-gray-400 py-1">Message deleted</p></div>
            }
            // Skip empty stubs so they don't render as a stray thin line.
            if (!r.body?.trim() && !r.image_url) return null
            return (
              <div key={r.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  <div className={`rounded-2xl px-4 py-2.5 ${isOwn ? 'rounded-tr-md text-white' : 'rounded-tl-md bg-white border border-gray-100 text-gray-700'}`} style={isOwn ? { backgroundColor: '#00267F' } : undefined}>
                    {r.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.body}</p>}
                    {r.image_url && (
                      <a href={r.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={r.image_url} alt="Shared photo" className="mt-2 rounded-lg" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10 }} />
                      </a>
                    )}
                  </div>
                  <p className={`text-[11px] text-gray-400 mt-1 ${isOwn ? 'mr-1 text-right' : 'ml-1'}`}>{fmtTime(r.created_at)}</p>
                </div>
              </div>
            )
          })}
          <div ref={threadEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
          {replyPhoto && (
            <div className="relative inline-block mb-2" style={{ width: 'fit-content' }}>
              <img src={replyPhoto.url} alt="Attachment preview" className="rounded-lg" style={{ maxHeight: 80, borderRadius: 8 }} />
              <button onClick={() => setReplyPhoto(null)} aria-label="Remove photo" className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white flex items-center justify-center" style={{ backgroundColor: '#111827', fontSize: 12, lineHeight: 1 }}>×</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 cursor-pointer flex items-center justify-center" style={{ opacity: photoUploading ? 0.5 : 1 }}>
              {photoUploading ? '…' : '📷'}
              <input type="file" accept="image/*" hidden disabled={photoUploading} onChange={e => { attachReplyPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <textarea value={newReplies[msg.id] || ''} onChange={e => setNewReplies(prev => ({ ...prev, [msg.id]: e.target.value }))} placeholder={`Reply to ${f?.name || 'the freelancer'}…`} rows={1} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white resize-none" style={{ maxHeight: 120 }} />
            <button onClick={() => sendReply(msg)} disabled={replySending || photoUploading || (!newReplies[msg.id]?.trim() && !replyPhoto)} className="flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
              {replySending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Freelancer details (right column) ─────────────────────────────
  function renderDetails(msg) {
    const f = msg.freelancers
    return (
      <>
        <div className="flex flex-col items-center text-center mb-6">
          <a href={`/freelancers/${f?.id}`} className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold overflow-hidden mb-3" style={{ backgroundColor: '#00267F' }}>
            {f?.avatar_url ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" /> : (f?.name || '?').split(' ').map(n => n[0]).join('')}
          </a>
          <p className="font-bold text-gray-900 flex items-center gap-1">{f?.name}{isVerified(f) && <VerifiedBadge size={14} />}</p>
          <p className="text-xs text-gray-500 mt-0.5">{f?.trade}</p>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</p>
          <div className="flex flex-col gap-3 text-sm">
            {f?.email && (
              <div className="flex items-center gap-2 text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="truncate">{f.email}</span>
              </div>
            )}
            {f?.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" /></svg>
                <span>{f.location}</span>
              </div>
            )}
            <a href={`/freelancers/${f?.id}`} className="flex items-center gap-2 hover:underline" style={{ color: '#00267F' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              View full profile
            </a>
          </div>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  const activeMsg = messages.find(m => m.id === expandedId) || null

  return (
    <main className="bg-gray-50 overflow-hidden" style={{ height: 'calc(100dvh - 68px)' }}>
      <div className="h-full flex max-w-[1500px] mx-auto bg-white border-x border-gray-100 min-h-0 overflow-hidden">
        {/* LEFT — thread list */}
        <aside className={`${activeMsg ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-shrink-0 flex-col border-r border-gray-100 min-h-0`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          {selectMode ? (
            <>
              <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <button
                    onClick={() => setDeleteConfirmMsg(messages.filter(m => selected.has(m.id)))}
                    className="text-sm font-semibold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    Delete ({selected.size})
                  </button>
                )}
                <button onClick={exitSelectMode} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">My messages</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{messages.length} conversation{messages.length !== 1 ? 's' : ''}</span>
                {messages.length > 0 && (
                  <button onClick={() => setSelectMode(true)} className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: '#00267F' }}>Select</button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center m-4">
            <EnvelopeIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-1">No messages yet</p>
            <p className="text-sm text-gray-500 mb-6">Contact a freelancer to start a conversation.</p>
            <a href="/search" className="inline-block px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
              Browse freelancers
            </a>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`cursor-pointer border-b border-gray-100 transition-colors ${selected.has(msg.id) ? 'bg-blue-50' : expandedId === msg.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                {/* Message header row */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => selectMode ? toggleSelect(msg.id) : handleExpand(msg)}
                >
                  {selectMode ? (
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors"
                      style={selected.has(msg.id) ? { backgroundColor: '#00267F', borderColor: '#00267F' } : { backgroundColor: 'transparent', borderColor: '#d1d5db' }}
                    >
                      {selected.has(msg.id) && (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      )}
                    </span>
                  ) : (
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: '#00267F' }}
                    >
                      {msg.freelancers?.avatar_url
                        ? <img src={msg.freelancers.avatar_url} alt={msg.freelancers.name} className="w-full h-full object-cover" />
                        : (msg.freelancers?.name || '?').split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className={`text-sm truncate ${msg.client_read === false ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                          {msg.freelancers?.name || 'Freelancer'}
                        </span>
                        {isVerified(msg.freelancers) && <VerifiedBadge size={13} />}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {new Date(msg.last_activity_at || msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-sm truncate flex-1 ${msg.client_read === false ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {msg.latest_preview || msg.message}
                      </p>
                      {msg.client_read === false && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#00267F' }} />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        </aside>

        {/* MIDDLE — conversation pane */}
        <section className={`${activeMsg ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0 bg-gray-50`}>
          {activeMsg ? renderConversation(activeMsg) : (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                <EnvelopeIcon className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">Select a conversation to read it here.</p>
              </div>
      {myReviews.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 sm:px-8 pb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-5">My reviews</h2>
          <div className="flex flex-col gap-3">
            {myReviews.map(review => (
              <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.freelancers?.name || 'Freelancer'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{review.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={`text-sm ${star <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {review.service_name && (
                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                    {review.service_name}
                  </span>
                )}
                <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
            </div>
          )}
        </section>

        {/* RIGHT — freelancer details pane */}
        {activeMsg && (
          <aside className="hidden lg:flex w-[300px] flex-shrink-0 flex-col border-l border-gray-100 overflow-y-auto p-6">
            {renderDetails(activeMsg)}
          </aside>
        )}
      </div>

      {/* Delete confirmation modal — deleteConfirmMsg is an array of msgs */}
      {deleteConfirmMsg && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDeleteConfirmMsg(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-base mb-2">
              {deleteConfirmMsg.length === 1 ? 'Delete this conversation?' : `Delete ${deleteConfirmMsg.length} conversations?`}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {deleteConfirmMsg.length === 1
                ? <>This will permanently delete your conversation with <span className="font-semibold text-gray-700">{deleteConfirmMsg[0].freelancers?.name || 'this professional'}</span>.</>
                : 'This will permanently delete the selected conversations.'} This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmMsg(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">Cancel</button>
              <button
                onClick={() => deleteConversations(deleteConfirmMsg)}
                disabled={deletingThread}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#DC2626' }}
              >
                {deletingThread ? 'Deleting…' : deleteConfirmMsg.length === 1 ? 'Delete' : `Delete ${deleteConfirmMsg.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Quote viewer modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setViewingQuote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-8 my-6 quote-doc-print" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {viewingQuote.freelancer?.avatar_url ? (
                  <img src={viewingQuote.freelancer.avatar_url} alt={viewingQuote.freelancer.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                    {(viewingQuote.freelancer?.name || '?').split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{viewingQuote.freelancer?.company_name || viewingQuote.freelancer?.name}</p>
                  <p className="text-sm text-gray-500">{viewingQuote.freelancer?.trade}</p>
                  <p className="text-xs text-gray-400">{viewingQuote.freelancer?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: viewingQuote.asReceipt ? '#166534' : '#00267F' }}>{viewingQuote.asReceipt ? 'RECEIPT' : viewingQuote.asInvoice ? 'INVOICE' : 'QUOTE'}</p>
                <p className="text-xs text-gray-400 mt-1">{viewingQuote.asInvoice ? (viewingQuote.quote.invoice_number || viewingQuote.quote.quote_number) : viewingQuote.quote.quote_number}</p>
                <p className="text-xs text-gray-400">{formatDocDate((viewingQuote.asInvoice ? viewingQuote.quote.invoiced_at : viewingQuote.quote.quote_date) || viewingQuote.quote.quote_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                {viewingQuote.asReceipt && (
                  <span className="inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>PAID IN FULL{viewingQuote.quote.paid_at ? ` · ${formatDocDate(viewingQuote.quote.paid_at)}` : ''}</span>
                )}
              </div>
            </div>
            <div className="h-0.5 mb-6 rounded-full" style={{ backgroundColor: '#F9C000' }} />
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Billed to</p>
              <p className="font-semibold text-gray-900">{viewingQuote.quote.client_name}</p>
              <p className="text-sm text-gray-500">{viewingQuote.quote.client_email}</p>
            </div>
            <table className="w-full mb-6 text-sm">
              <thead>
                <tr style={{ backgroundColor: '#00267F' }}>
                  <th className="text-left px-3 py-2 text-white font-medium rounded-tl-lg text-xs">Description</th>
                  <th className="text-center px-3 py-2 text-white font-medium text-xs w-12">Qty</th>
                  <th className="text-right px-3 py-2 text-white font-medium text-xs w-20">Unit price</th>
                  <th className="text-right px-3 py-2 text-white font-medium rounded-tr-lg text-xs w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewingQuote.quote.items || []).map((item, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--row-stripe)' : 'var(--surface-card)' }}>
                    <td className="px-3 py-2 text-gray-700">{item.description || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 text-center">{item.qty}</td>
                    <td className="px-3 py-2 text-gray-700 text-right">{item.price ? `$${parseFloat(item.price).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 text-right">
                      {item.price ? `$${((parseFloat(item.price)||0) * (parseInt(item.qty)||1)).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mb-6">
              <div className="w-48">
                <div className="flex justify-between py-2 border-t border-gray-200">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="text-sm font-medium text-gray-900">${Number(viewingQuote.quote.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-1">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(viewingQuote.quote.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: viewingQuote.asReceipt ? '#DCFCE7' : '#EEF2FF' }}>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">{viewingQuote.asReceipt ? 'Paid in full' : 'Payment due'}</p>
              <p className="text-sm font-bold" style={{ color: viewingQuote.asReceipt ? '#166534' : '#00267F' }}>{viewingQuote.asReceipt
                ? (viewingQuote.quote.paid_at ? `Received ${formatDocDate(viewingQuote.quote.paid_at, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Received')
                : formatDocDate((viewingQuote.asInvoice ? viewingQuote.quote.invoice_due_date : viewingQuote.quote.due_date) || viewingQuote.quote.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            {viewingQuote.quote.notes && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{viewingQuote.quote.notes}</p>
              </div>
            )}
            <div className="border-t border-gray-100 pt-4 text-center mb-6">
              <p className="text-xs text-gray-400">Generated via <span className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</span> · Connecting Barbados</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setViewingQuote(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
                Close
              </button>
              {viewingQuote.asReceipt ? (
                <>
                  <button
                    onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer, { type: 'receipt' })}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    Receipt PDF
                  </button>
                  <button
                    onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer, { type: 'invoice' })}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    Invoice PDF
                  </button>
                </>
              ) : viewingQuote.asInvoice ? (
                <>
                  <button
                    onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer, { type: 'invoice' })}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    Invoice PDF
                  </button>
                  <button
                    onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    Quote PDF
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    Quote PDF
                  </button>
                  {viewingQuote.quote.invoice_number && (
                    <button
                      onClick={() => printSavedQuote(viewingQuote.quote, viewingQuote.freelancer, { type: 'invoice' })}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#00267F' }}
                    >
                      Invoice PDF
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
