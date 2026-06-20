'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatParish } from '@/lib/formatParish'
import { getQuoteId, dedupeThreadReplies, conversationPreview, quoteReplyKind, isReceiptBody } from '@/lib/quoteReply'
import { parsePrice } from '@/lib/price'
import { printSavedQuote } from '@/lib/printQuote'
import { formatDocDate } from '@/lib/formatDate'
import { useRealtimeThreads } from '@/lib/useRealtimeThreads'
import { uploadChatPhoto } from '@/lib/uploadChatPhoto'
import { PAYMENT_TERMS, termDays } from '@/lib/paymentTerms'
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge'
import ReceiptLineCard from '@/components/ReceiptLineCard'

function EnvelopeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

export default function Inbox() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [replies, setReplies] = useState({})
  const [replyText, setReplyText] = useState({})
  const [replyPhoto, setReplyPhoto] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [replySending, setReplySending] = useState(false)
  const [quoteMsg, setQuoteMsg] = useState(null)
  const [threadQuotes, setThreadQuotes] = useState({})
  const [viewingQuote, setViewingQuote] = useState(null)
  const [freelancerServices, setFreelancerServices] = useState([])
  const [quoteNumber, setQuoteNumber] = useState('')
  const [quoteItems, setQuoteItems] = useState([{ description: '', qty: 1, price: '' }])
  const [quoteDate, setQuoteDate] = useState(() => {
    const now = new Date()
    const ast = new Date(now.getTime() - (4 * 60 * 60 * 1000))
    return ast.toISOString().split('T')[0]
  })
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('net14')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteClientName, setQuoteClientName] = useState('')
  const [quoteClientEmail, setQuoteClientEmail] = useState('')
  const [quoteToast, setQuoteToast] = useState(null)
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmDeleteReplyId, setConfirmDeleteReplyId] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null)
  const [deletingThread, setDeletingThread] = useState(false)

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()) }
  const [toast, setToast] = useState(null)
  const [confirmDeleteQuoteId, setConfirmDeleteQuoteId] = useState(null)
  const [invoicingQuoteId, setInvoicingQuoteId] = useState(null)
  const [invoiceTerms, setInvoiceTerms] = useState('net14')
  const [invoiceBusy, setInvoiceBusy] = useState(false)
  const [clientRatings, setClientRatings] = useState({})
  const [clientProfiles, setClientProfiles] = useState({})
  const threadEndRef = useRef(null)

  // Opening a thread (or sending into it) scrolls the newest message
  // and composer into view — read the latest first, scroll up for history
  const expandedReplyCount = expandedId ? (replies[expandedId] || []).length : 0
  // Quote/invoice/receipt cards load lazily after expand; re-scroll once
  // they resolve so the thread lands fully at the bottom, not short.
  const expandedQuotesLoaded = expandedId
    ? (replies[expandedId] || []).map(getQuoteId).filter(Boolean).filter(qid => threadQuotes[qid]).length
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

  const unreadCount = messages.filter(m => !m.read).length

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null)
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  const { user: authUser, loading: authLoading } = useAuth()

  // Rebuild the thread list (messages + latest-reply previews + client
  // profiles/ratings). Shared by the initial load and the live-refresh poll.
  async function loadInboxList(p) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('freelancer_id', p.id)
      .order('created_at', { ascending: false })

    const messageList = msgs || []
    if (messageList.length === 0) {
      setMessages([])
      return
    }

    // Latest reply per thread → preview the newest message and sort by activity
    const { data: latestReplies } = await supabase
      .from('message_replies')
      .select('message_id, created_at, body, sender_user_id, quote_id')
      .in('message_id', messageList.map(m => m.id))
      .order('created_at', { ascending: false })

    const latestReply = {}
    ;(latestReplies || []).forEach(r => {
      if (!latestReply[r.message_id]) latestReply[r.message_id] = r
    })

    const enriched = messageList
      .map(m => {
        const last = latestReply[m.id]
        return {
          ...m,
          last_activity_at: last?.created_at || m.created_at,
          latest_preview: last ? conversationPreview(last, authUser?.id) : m.message,
        }
      })
      .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
    setMessages(enriched)

    // Live client profiles (current name + photo) and aggregate ratings.
    const clientIds = [...new Set(messageList.map(m => m.sender_user_id).filter(Boolean))]
    if (clientIds.length > 0) {
      const { data: cps } = await supabase
        .from('client_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', clientIds)
      const cpMap = {}
      for (const cp of cps || []) cpMap[cp.user_id] = cp
      setClientProfiles(cpMap)

      const { data: clientRevs } = await supabase
        .from('reviews')
        .select('client_user_id, rating')
        .in('client_user_id', clientIds)
        .eq('type', 'freelancer')
      const agg = {}
      for (const r of clientRevs || []) {
        if (!agg[r.client_user_id]) agg[r.client_user_id] = { sum: 0, count: 0 }
        agg[r.client_user_id].sum += r.rating
        agg[r.client_user_id].count += 1
      }
      const ratings = {}
      for (const [cid, a] of Object.entries(agg)) {
        ratings[cid] = { avg: Math.round((a.sum / a.count) * 10) / 10, count: a.count }
      }
      setClientRatings(ratings)
    }
  }

  useEffect(() => {
    if (authLoading) return
    async function init() {
      const user = authUser
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: p } = await supabase
        .from('freelancers')
        .select('id, name, avatar_url, trade, company_name, location, email, verified, phone_verified')
        .eq('user_id', user.id)
        .single()

      if (p) {
        setProfile(p)
        const { data: svc } = await supabase
          .from('services')
          .select('id, name, price, description, duration')
          .eq('freelancer_id', p.id)
          .order('created_at', { ascending: true })
        setFreelancerServices(svc || [])
        await loadInboxList(p)
      } else {
        // No freelancer profile → this user is a client. /inbox is the
        // freelancer inbox; their messages live at /messages. Redirect there
        // (replace, so the back button doesn't return to this dead end)
        // instead of showing the freelancer-only empty state.
        router.replace('/messages')
        return
      }

      setLoading(false)
    }
    init()
  }, [authUser, authLoading, router])

  // Re-pull the thread list (and the open thread's replies + quotes) so the
  // inbox updates while you sit on it — new client messages, replies and quote
  // responses appear without a reload. Driven by Supabase Realtime (instant),
  // with a slow interval + tab-focus refresh as a safety net.
  async function refresh() {
    if (!profile) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    await loadInboxList(profile)
    if (expandedId) {
      const { data: r } = await supabase
        .from('message_replies')
        .select('*')
        .eq('message_id', expandedId)
        .order('created_at', { ascending: true })
      setReplies(prev => ({ ...prev, [expandedId]: r || [] }))
      const quoteIds = (r || []).map(getQuoteId).filter(Boolean)
      if (quoteIds.length > 0) {
        const { data: qs } = await supabase.from('quotes').select('*').in('id', quoteIds)
        if (qs) setThreadQuotes(prev => ({ ...prev, ...Object.fromEntries(qs.map(q => [q.id, q])) }))
      }
    }
  }

  useRealtimeThreads(!!profile, refresh)

  // Safety-net poll (covers the case where realtime isn't enabled / drops).
  useEffect(() => {
    if (!profile) return
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [profile, expandedId])

  function openQuote(msg, prefillItems = null) {
    setQuoteMsg(msg)
    setQuoteClientName(msg.sender_name || '')
    setQuoteClientEmail(msg.sender_email || '')
    setQuoteItems(prefillItems?.length > 0 ? prefillItems : [{ description: '', qty: 1, price: '' }])
    const now = new Date()
    const ast = new Date(now.getTime() - (4 * 60 * 60 * 1000))
    const astDate = ast.toISOString().split('T')[0]
    setQuoteDate(astDate)
    setQuotePaymentTerms('net14')
    setQuoteNotes('')
    setQuoteNumber(`QT-${astDate.replace(/-/g, '').slice(0, 8)}-${Math.floor(Math.random()*900)+100}`)
  }

  // Service enquiries from profiles list services as "• Name: price"
  // lines — parse them so the freelancer can build the quote in one
  // click instead of re-typing everything.
  function quoteItemsFromEnquiry(text) {
    const items = []
    for (const line of (text || '').split('\n')) {
      const m = line.match(/^\s*[•\-\*]\s*(.+?):\s*\$?([\d.,]+)\s*$/)
      if (!m) continue
      const name = m[1].trim()
      // Prefer the live service (current price + description) over the
      // snapshot in the message
      const svc = freelancerServices.find(s => s.name?.toLowerCase() === name.toLowerCase())
      const price = svc ? (parsePrice(svc.price) ?? parsePrice(m[2])) : parsePrice(m[2])
      items.push({
        description: svc
          ? svc.name + (svc.description ? ' — ' + svc.description : '')
          : name,
        qty: 1,
        price: price ?? '',
      })
    }
    return items
  }

  function quoteTotal() {
    return quoteItems.reduce((sum, item) => {
      const p = parseFloat(item.price) || 0
      const q = parseInt(item.qty) || 1
      return sum + p * q
    }, 0)
  }

  function quoteDueDate() {
    const [y, m, d] = quoteDate.split('-').map(Number)
    const base = new Date(y, m - 1, d) // local midnight — no UTC offset flip
    const days = termDays(quotePaymentTerms)
    base.setDate(base.getDate() + days)
    return base.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function updateItem(index, field, value) {
    setQuoteItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addServiceToQuote(service) {
    const price = parsePrice(service.price) ?? ''
    const newItem = {
      description: service.name + (service.description ? ' — ' + service.description : ''),
      qty: 1,
      price: price || '',
    }
    setQuoteItems(prev => {
      const emptyIndex = prev.findIndex(i => !i.description && !i.price)
      if (emptyIndex >= 0) {
        return prev.map((item, i) => i === emptyIndex ? newItem : item)
      }
      return [...prev, newItem]
    })
  }

  function addItem() {
    setQuoteItems(prev => [...prev, { description: '', qty: 1, price: '' }])
  }

  function removeItem(index) {
    setQuoteItems(prev => prev.filter((_, i) => i !== index))
  }

  function printQuote() {
    const subtotal = quoteTotal()
    const validCompanyName = profile?.company_name?.trim().length > 3 ? profile.company_name : null
    const itemRows = quoteItems.map((item, i) => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.description||'—'}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.qty}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+parseFloat(item.price).toFixed(2):'—'}</td>
        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+((parseFloat(item.price)||0)*(parseInt(item.qty)||1)).toFixed(2):'—'}</td>
      </tr>`).join('')

    const avatarHtml = profile?.avatar_url
      ? `<img src="${profile.avatar_url}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block"/>`
      : `<div style="width:56px;height:56px;border-radius:50%;background:#00267F;color:white;font-size:18px;font-weight:700;text-align:center;line-height:56px;display:block">${(profile?.name||'?').split(' ').map(n=>n[0]).join('')}</div>`

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Quote-${quoteNumber}-${quoteClientName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:white; color:#111827; padding:40px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { margin:1.2cm; size:A4; }
  table { border-collapse:collapse; }
  * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
</style>
</head>
<body>

  <!-- Header: avatar/info left, QUOTE right — table layout -->
  <table width="100%" style="margin-bottom:28px">
    <tr>
      <td style="vertical-align:top;width:50%">
        <table>
          <tr>
            <td style="vertical-align:top;padding-right:14px">
              ${avatarHtml}
            </td>
            <td style="vertical-align:top">
              <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:2px">${validCompanyName||profile?.name||''}</div>
              ${validCompanyName?`<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${profile?.name}</div>`:''}
              <div style="font-size:13px;color:#6b7280;margin-bottom:1px">${profile?.trade||''}</div>
              <div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${formatParish(profile?.location)||''}</div>
              ${profile?.email?`<div style="font-size:12px;color:#9ca3af">${profile.email}</div>`:''}
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:top;text-align:right;width:50%">
        <div style="font-size:34px;font-weight:800;color:#00267F;letter-spacing:4px;line-height:1">QUOTE</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:6px">${quoteNumber}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:2px">${new Date(quoteDate + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
      </td>
    </tr>
  </table>

  <!-- Gold divider -->
  <table width="100%" style="margin-bottom:24px"><tr><td style="background:#F9C000;height:3px;border-radius:2px;font-size:0">&nbsp;</td></tr></table>

  <!-- Billed to -->
  <div style="margin-bottom:24px">
    <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Billed to</div>
    <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px">${quoteClientName||'Client'}</div>
    <div style="font-size:13px;color:#6b7280">${quoteClientEmail}</div>
  </div>

  <!-- Line items -->
  <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#00267F">
        <th style="padding:10px 14px;text-align:left;color:white;font-size:12px;font-weight:600">Description</th>
        <th style="padding:10px 14px;text-align:center;color:white;font-size:12px;font-weight:600;width:60px">Qty</th>
        <th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Unit price</th>
        <th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals — right aligned using table -->
  <table width="100%" style="margin-bottom:24px">
    <tr>
      <td width="60%"></td>
      <td width="40%">
        <table width="100%">
          <tr>
            <td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Subtotal</td>
            <td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right">$${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#111827">Total</td>
            <td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#00267F;text-align:right">$${subtotal.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Payment due box -->
  <table width="100%" style="margin-bottom:24px">
    <tr>
      <td style="background:#EEF2FF;border-radius:10px;padding:16px 18px">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Payment due</div>
        <div style="font-size:16px;font-weight:700;color:#00267F;margin-bottom:3px">${quoteDueDate()}</div>
        <div style="font-size:12px;color:#9ca3af">${quotePaymentTerms==='due_receipt'?'Payment due upon receipt':quotePaymentTerms.replace('net','Net ')+' days from invoice date'}</div>
      </td>
    </tr>
  </table>

  ${quoteNotes?.trim()?`
  <!-- Notes -->
  <table width="100%" style="margin-bottom:24px">
    <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px">
      <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Notes</div>
      <div style="font-size:13px;color:#374151;line-height:1.7">${quoteNotes}</div>
    </td></tr>
  </table>`:''}

  <!-- Footer -->
  <table width="100%">
    <tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center">
      <div style="font-size:11px;color:#9ca3af">Generated via <span style="color:#00267F;font-weight:600">Vetted.bb</span> &middot; Connecting Barbados</div>
    </td></tr>
  </table>

</body>
</html>`

    const printFrame = document.createElement('iframe')
    printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;'
    document.body.appendChild(printFrame)
    const doc = printFrame.contentDocument || printFrame.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()
    printFrame.contentWindow.focus()
    setTimeout(() => {
      printFrame.contentWindow.print()
      setTimeout(() => document.body.removeChild(printFrame), 1500)
    }, 800)
  }

  function printViewingQuote(q) {
    printSavedQuote(q, profile)
  }

  async function saveQuoteInApp() {
    if (quoteSaving) return // guard against double-submit creating duplicate quotes
    setQuoteSaving(true)
    const [qy, qm, qd] = quoteDate.split('-').map(Number)
    const days = termDays(quotePaymentTerms)
    const due = new Date(qy, qm - 1, qd + days) // local date, no UTC flip
    const dueStr = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`

    const { data: savedQuote, error } = await supabase
      .from('quotes')
      .insert({
        message_id: quoteMsg.id,
        freelancer_id: profile.id,
        quote_number: quoteNumber,
        quote_date: quoteDate,
        payment_terms: quotePaymentTerms,
        due_date: dueStr,
        client_name: quoteClientName,
        client_email: quoteClientEmail,
        items: quoteItems,
        subtotal: quoteTotal(),
        total: quoteTotal(),
        notes: quoteNotes,
        status: 'sent',
      })
      .select()
      .single()

    if (error) {
      alert('Could not send quote. Please try again.')
      setQuoteSaving(false)
      return
    }

    // quote_id is the real link; the body is a readable fallback for
    // any client that doesn't resolve the quote.
    const { data: quoteReply } = await supabase.from('message_replies').insert({
      message_id: quoteMsg.id,
      sender_name: profile.name,
      sender_user_id: user?.id,
      body: `Sent quote ${quoteNumber}`,
      quote_id: savedQuote.id,
    }).select().single()

    // Show the quote card in the open thread immediately — otherwise it
    // only appears after a page reload.
    setThreadQuotes(prev => ({ ...prev, [savedQuote.id]: savedQuote }))
    if (quoteReply) {
      setReplies(prev => ({ ...prev, [quoteMsg.id]: [...(prev[quoteMsg.id] || []), quoteReply] }))
    }

    // Flag unread for the client and notify them (fire-and-forget)
    supabase.from('messages').update({ client_read: false }).eq('id', quoteMsg.id).then(() => {})
    fetch('/api/notify-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: quoteMsg.id, kind: 'quote' }),
    }).catch(() => {})

    const recipientName = quoteClientName
    setQuoteMsg(null)
    setQuoteSaving(false)
    setQuoteToast(`Quote sent to ${recipientName}`)
    setTimeout(() => setQuoteToast(null), 4000)
  }

  // Turn an accepted quote into a formal invoice — same flow as the
  // quotes/earnings page, available right here in the conversation.
  const INVOICE_TERMS = PAYMENT_TERMS

  async function sendInvoiceFromInbox(quote, replyMsgId) {
    setInvoiceBusy(true)
    const terms = INVOICE_TERMS.find(t => t.value === invoiceTerms) || INVOICE_TERMS[2]
    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + terms.days)
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900) + 100}`
    const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

    const patch = {
      status: 'invoiced',
      invoice_number: invoiceNumber,
      invoiced_at: now.toISOString(),
      invoice_terms: terms.value,
      invoice_due_date: dueStr,
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quote.id)
    if (error) {
      setInvoiceBusy(false)
      showToast('Could not send the invoice. Please try again.', true)
      return
    }
    setThreadQuotes(prev => ({ ...prev, [quote.id]: { ...prev[quote.id], ...patch } }))
    setInvoicingQuoteId(null)

    const { data: invReply } = await supabase.from('message_replies').insert({
      message_id: replyMsgId,
      sender_name: profile.name,
      sender_user_id: user?.id,
      quote_id: quote.id,
      body: `Sent invoice ${invoiceNumber} — payment due ${fmt(dueStr)} (${terms.label.toLowerCase()})`,
    }).select().single()
    if (invReply) setReplies(prev => ({ ...prev, [replyMsgId]: [...(prev[replyMsgId] || []), invReply] }))

    supabase.from('messages').update({ client_read: false }).eq('id', replyMsgId).then(() => {})
    fetch('/api/notify-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: replyMsgId,
        kind: 'invoice',
        message: `Invoice ${invoiceNumber} for $${Number(quote.total).toFixed(2)} — payment due ${fmt(dueStr)}`,
      }),
    }).catch(() => {})

    setInvoiceBusy(false)
    setQuoteToast(`Invoice sent`)
    setTimeout(() => setQuoteToast(null), 4000)
  }

  async function sendQuoteToClient() {
    const lines = quoteItems.map(i =>
      `${i.description || 'Item'} (x${i.qty}) — $${((parseFloat(i.price)||0) * (parseInt(i.qty)||1)).toFixed(2)}`
    ).join('\n')
    const body = [
      `Hi ${quoteClientName},`,
      '',
      `Please find your quote below from ${profile.company_name || profile.name}:`,
      '',
      `Quote number: ${quoteNumber}`,
      `Date: ${new Date(quoteDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      `Payment due: ${quoteDueDate()}`,
      '',
      '─────────────────────────',
      lines,
      '─────────────────────────',
      `Total: $${quoteTotal().toFixed(2)}`,
      '',
      quoteNotes ? `Notes: ${quoteNotes}` : '',
      '',
      `Best regards,`,
      profile.name,
      profile.trade || '',
      profile.email || '',
    ].filter(l => l !== null).join('\n')
    window.location.href = `mailto:${quoteClientEmail}?subject=${encodeURIComponent(`Quote ${quoteNumber} — ${profile.company_name || profile.name}`)}&body=${encodeURIComponent(body)}`
  }

  async function attachReplyPhoto(file) {
    if (!file) return
    setPhotoUploading(true)
    const { url, error } = await uploadChatPhoto(file, user?.id)
    if (error) alert(error)
    else setReplyPhoto({ url })
    setPhotoUploading(false)
  }

  async function sendReply(msg) {
    const text = replyText[msg.id]?.trim()
    const imageUrl = replyPhoto?.url || null
    if (!text && !imageUrl) return
    setReplySending(true)
    const { data, error } = await supabase
      .from('message_replies')
      .insert({
        message_id: msg.id,
        sender_name: profile.name,
        sender_user_id: user?.id,
        body: text || '',
        image_url: imageUrl,
      })
      .select()
      .single()
    if (!error) {
      setReplies(prev => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), data] }))
      setReplyText(prev => ({ ...prev, [msg.id]: '' }))
      setReplyPhoto(null)
      // Flag the thread unread for the client's header badge
      supabase.from('messages').update({ client_read: false }).eq('id', msg.id).then(() => {})
      // Email + push the client (fire-and-forget)
      fetch('/api/notify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msg.id, message: text || '📷 Photo' }),
      }).catch(() => {})
    }
    setReplySending(false)
  }

  async function handleExpand(msg) {
    if (expandedId === msg.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(msg.id)
    if (!msg.read) {
      await supabase.from('messages').update({ read: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
      // Clear the matching bell notifications and refresh the nav badge now —
      // reading here, rather than via the bell, must still mark them read.
      supabase.from('notifications').update({ read: true })
        .eq('user_id', user.id).eq('read', false).eq('type', 'message').then(() => {})
      window.dispatchEvent(new Event('vetted:refresh-unread'))
    }
    const { data: r } = await supabase
      .from('message_replies')
      .select('*')
      .eq('message_id', msg.id)
      .order('created_at', { ascending: true })
    setReplies(prev => ({ ...prev, [msg.id]: r || [] }))
    const quoteIds = (r || []).map(getQuoteId).filter(Boolean)
    if (quoteIds.length > 0) {
      const { data: qs } = await supabase
        .from('quotes')
        .select('*')
        .in('id', quoteIds)
      if (qs) {
        const map = {}
        qs.forEach(q => { map[q.id] = q })
        setThreadQuotes(prev => ({ ...prev, ...map }))
      }
    }
  }

  function showToast(msg, isError = false) {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 3500)
  }

  async function deleteReply(replyId, msgId) {
    // Supabase: DELETE FROM message_replies WHERE id = replyId
    const { error } = await supabase
      .from('message_replies')
      .delete()
      .eq('id', replyId)
    if (error) {
      showToast('Failed to delete. Please try again.', true)
      return
    }
    setReplies(prev => ({
      ...prev,
      [msgId]: (prev[msgId] || []).map(r => r.id === replyId ? { ...r, _deleted: true } : r),
    }))
    setReplyDeleteConfirm(null)
    setReplyMenuOpen(null)
    showToast('Message deleted')
  }

  async function handleDeleteReply(replyId) {
    setConfirmDeleteReplyId(null)
    // Optimistic update — mark deleted across all loaded threads
    setReplies(prev => {
      const updated = { ...prev }
      for (const msgId of Object.keys(updated)) {
        updated[msgId] = updated[msgId].map(r =>
          r.id === replyId ? { ...r, _deleted: true } : r
        )
      }
      return updated
    })
    const { error } = await supabase
      .from('message_replies')
      .delete()
      .eq('id', replyId)
    if (error) {
      console.error('Delete reply error:', error)
      // Revert optimistic update
      setReplies(prev => {
        const updated = { ...prev }
        for (const msgId of Object.keys(updated)) {
          updated[msgId] = updated[msgId].map(r =>
            r.id === replyId ? { ...r, _deleted: false } : r
          )
        }
        return updated
      })
      showToast('Failed to delete. Try again.', true)
    } else {
      showToast('Message deleted')
    }
  }

  async function handleDeleteQuote(quoteId, replyId) {
    setConfirmDeleteQuoteId(null)
    // Optimistic: remove quote from threadQuotes and the stub reply from replies
    setThreadQuotes(prev => { const u = { ...prev }; delete u[quoteId]; return u })
    setReplies(prev => {
      const updated = { ...prev }
      for (const msgId of Object.keys(updated)) {
        updated[msgId] = updated[msgId].filter(r => r.id !== replyId)
      }
      return updated
    })
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId)
    if (error) {
      console.error('Delete quote error:', error)
      showToast('Failed to delete quote. Try again.', true)
    } else {
      showToast('Quote deleted')
    }
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
      showToast('Failed to delete. Please try again.', true)
    } else {
      showToast(msgs.length === 1 ? 'Conversation deleted' : `${msgs.length} conversations deleted`)
    }
    setDeletingThread(false)
  }

  // ── Conversation pane (middle column) ─────────────────────────────
  function renderConversation(msg) {
    const clientName = clientProfiles[msg.sender_user_id]?.display_name || msg.sender_name
    const clientAvatar = clientProfiles[msg.sender_user_id]?.avatar_url
    const prefillTop = quoteItemsFromEnquiry(msg.message)
    const fmtTime = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return (
      <>
        {/* Conversation header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <button onClick={() => setExpandedId(null)} className="md:hidden text-gray-500 p-1 -ml-1" aria-label="Back to list">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 overflow-hidden flex-shrink-0">
            {clientAvatar ? <img src={clientAvatar} alt={clientName} className="w-full h-full object-cover" /> : (clientName?.[0]?.toUpperCase() || '?')}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{clientName}</p>
            <p className="text-xs text-gray-400 truncate">{msg.subject}</p>
          </div>
        </div>

        {/* Messages — block (not flex) so cards/bubbles keep their natural
            height; a flex column shrinks children into thin lines when full. */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 min-h-0">
          {/* Original enquiry (client → left) */}
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <div className="rounded-2xl rounded-tl-md px-4 py-2.5 bg-white border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 ml-1">{fmtTime(msg.created_at)}</p>
            </div>
          </div>
          {prefillTop.length > 0 && (
            <button onClick={() => openQuote(msg, prefillTop)} className="self-start text-xs font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity inline-flex items-center gap-1.5" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
              {prefillTop.length === 1 ? '⚡ Quote this service →' : '⚡ Quote these services →'}
            </button>
          )}

          {dedupeThreadReplies(replies[msg.id] || [], threadQuotes).map(r => {
            const quoteId = getQuoteId(r)
            const quoteData = quoteId ? (threadQuotes[quoteId] || null) : null
            const kind = quoteReplyKind(r)
            if (quoteId && quoteData) {
              const cardTitle = kind === 'receipt' ? `Receipt ${quoteData.invoice_number || quoteData.quote_number}`
                : kind === 'invoice' ? `Invoice ${quoteData.invoice_number || quoteData.quote_number}`
                : `Quote ${quoteData.quote_number}`
              const cardDate = formatDocDate(kind === 'quote' ? quoteData.quote_date : (quoteData.invoiced_at || quoteData.quote_date))
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: kind === 'receipt' ? '#166534' : '#00267F' }}>
                    <div>
                      <p className="text-white font-semibold text-sm">{cardTitle}</p>
                      <p className="text-xs mt-0.5" style={{ color: kind === 'receipt' ? '#86efac' : '#93b8ff' }}>From {r.sender_name} · {cardDate}</p>
                    </div>
                    <button onClick={() => setViewingQuote(quoteData)} className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                      View & download
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-gray-400">Total</p>
                        <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(quoteData.total).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{kind === 'receipt' ? 'Paid' : 'Payment due'}</p>
                        <p className="text-sm font-semibold" style={{ color: kind === 'receipt' ? '#166534' : '#374151' }}>{kind === 'receipt' ? formatDocDate(quoteData.paid_at) : formatDocDate(quoteData.due_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                        {quoteData.status === 'invoiced' ? 'Invoiced' : quoteData.status}
                      </span>
                      {quoteData.status === 'accepted' && (
                        <button onClick={() => setInvoicingQuoteId(invoicingQuoteId === quoteData.id ? null : quoteData.id)} className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                          Send invoice →
                        </button>
                      )}
                      {confirmDeleteQuoteId === quoteData.id ? (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          Delete?{' '}
                          <button onClick={() => handleDeleteQuote(quoteData.id, r.id)} className="text-red-600 font-semibold hover:text-red-800">Yes</button>
                          {' · '}
                          <button onClick={() => setConfirmDeleteQuoteId(null)} className="text-gray-500 font-semibold hover:text-gray-700">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDeleteQuoteId(quoteData.id)} className="text-xs text-red-500 hover:text-red-700">
                          Delete quote
                        </button>
                      )}
                    </div>
                  </div>
                  {invoicingQuoteId === quoteData.id && quoteData.status === 'accepted' && (
                    <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Payment terms</label>
                        <select value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
                          {INVOICE_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <button onClick={() => sendInvoiceFromInbox(quoteData, r.message_id)} disabled={invoiceBusy} className="text-xs font-semibold px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                        {invoiceBusy ? 'Sending…' : 'Send invoice'}
                      </button>
                    </div>
                  )}
                </div>
              )
            }
            if (isReceiptBody(r.body)) {
              return <div key={r.id}><ReceiptLineCard body={r.body} fromName={r.sender_name} /></div>
            }
            const isOwnReply = !!(
              (r.sender_user_id && user?.id && r.sender_user_id === user.id) ||
              (!r.sender_user_id && r.sender_name === profile?.name)
            )
            if (r._deleted) {
              return <div key={r.id} className={`flex ${isOwnReply ? 'justify-end' : 'justify-start'}`}><p className="text-xs italic text-gray-400 py-1">Message deleted</p></div>
            }
            // Skip empty stubs (e.g. quote replies whose card rendered above) —
            // an empty bubble shows as a stray thin line.
            if (!r.body?.trim() && !r.image_url) return null
            const replyPrefill = !isOwnReply ? quoteItemsFromEnquiry(r.body) : []
            return (
              <div key={r.id} className={`flex ${isOwnReply ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  <div className={`rounded-2xl px-4 py-2.5 ${isOwnReply ? 'rounded-tr-md text-white' : 'rounded-tl-md bg-white border border-gray-100 text-gray-700'}`} style={isOwnReply ? { backgroundColor: '#00267F' } : undefined}>
                    {r.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.body}</p>}
                    {r.image_url && (
                      <a href={r.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={r.image_url} alt="Shared photo" className="mt-2 rounded-lg" style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10 }} />
                      </a>
                    )}
                    {replyPrefill.length > 0 && (
                      <button onClick={() => openQuote(msg, replyPrefill)} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                        {replyPrefill.length === 1 ? '⚡ Quote this service →' : '⚡ Quote these services →'}
                      </button>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${isOwnReply ? 'justify-end mr-1' : 'ml-1'}`}>
                    <p className="text-[11px] text-gray-400">{fmtTime(r.created_at)}</p>
                    {isOwnReply && (confirmDeleteReplyId === r.id ? (
                      <span className="text-[11px] text-gray-500">Delete? <button onClick={() => handleDeleteReply(r.id)} className="text-red-600 font-semibold">Yes</button> · <button onClick={() => setConfirmDeleteReplyId(null)} className="text-gray-500 font-semibold">No</button></span>
                    ) : (
                      <button onClick={() => setConfirmDeleteReplyId(r.id)} className="text-[11px] text-red-400 hover:text-red-600">Delete</button>
                    ))}
                  </div>
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
            <button onClick={() => openQuote(msg)} title="Create quote" className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity text-sm font-bold" style={{ backgroundColor: '#00267F' }}>$</button>
            <label className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 cursor-pointer flex items-center justify-center" style={{ opacity: photoUploading ? 0.5 : 1 }}>
              {photoUploading ? '…' : '📷'}
              <input type="file" accept="image/*" hidden disabled={photoUploading} onChange={e => { attachReplyPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <textarea value={replyText[msg.id] || ''} onChange={e => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))} placeholder="Write a reply…" rows={1} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white resize-none" style={{ maxHeight: 120 }} />
            <button onClick={() => sendReply(msg)} disabled={replySending || photoUploading || (!replyText[msg.id]?.trim() && !replyPhoto)} className="flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
              {replySending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Contact details (right column) ────────────────────────────────
  function renderDetails(msg) {
    const cp = clientProfiles[msg.sender_user_id]
    const name = cp?.display_name || msg.sender_name
    const rating = clientRatings[msg.sender_user_id]
    return (
      <>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-semibold text-gray-600 overflow-hidden mb-3">
            {cp?.avatar_url ? <img src={cp.avatar_url} alt={name} className="w-full h-full object-cover" /> : (name?.[0]?.toUpperCase() || '?')}
          </div>
          <p className="font-bold text-gray-900">{name}</p>
          {rating && <span className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(249,192,0,0.15)', color: '#92400E' }}>★ {rating.avg} ({rating.count})</span>}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</p>
          <div className="flex flex-col gap-3 text-sm">
            {msg.sender_email && (
              <div className="flex items-center gap-2 text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="truncate">{msg.sender_email}</span>
              </div>
            )}
            {msg.sender_user_id && (
              <a href={`/clients/${msg.sender_user_id}`} className="flex items-center gap-2 hover:underline" style={{ color: '#00267F' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                View client profile
              </a>
            )}
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
      {/* Hide the global footer on mobile so the chat fills the viewport and
          never scrolls past the reply box. Removed when this page unmounts. */}
      <style>{`@media (max-width: 767px){ footer{ display:none !important } }`}</style>
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
              <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && <span className="text-sm text-gray-500">{unreadCount} unread</span>}
                {messages.length > 0 && (
                  <button onClick={() => setSelectMode(true)} className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: '#00267F' }}>Select</button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
        {!profile ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center m-4">
            <p className="text-gray-500 text-sm">You need a freelancer profile to receive messages.</p>
            <a href="/dashboard" className="mt-4 inline-block text-sm font-medium hover:opacity-80" style={{ color: '#00267F' }}>Create a profile →</a>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center flex flex-col items-center">
            <EnvelopeIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="font-semibold text-gray-900 mb-2">No messages yet</p>
            <p className="text-sm mb-6 max-w-xs" style={{ color: '#6B7280', fontFamily: "'Inter', sans-serif" }}>
              No messages yet. Share your profile to start receiving enquiries.
            </p>
            {profile && (() => {
              const profileUrl = `https://vetted-bb.vercel.app/freelancers/${profile.id}`
              const loc = profile.location ? `based in ${formatParish(profile.location)}` : 'in Barbados'
              const text = `Check out ${profile.name} on Vetted.bb — they're a ${profile.trade} ${loc}. ${profileUrl}`
              const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share on WhatsApp
                </a>
              )
            })()}
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => selectMode ? toggleSelect(msg.id) : handleExpand(msg)}
                className={`group cursor-pointer border-b border-gray-100 transition-colors ${selected.has(msg.id) ? 'bg-blue-50' : expandedId === msg.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <div className="px-4 py-3 flex items-center gap-3">
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
                    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
                      {clientProfiles[msg.sender_user_id]?.avatar_url
                        ? <img src={clientProfiles[msg.sender_user_id].avatar_url} alt={msg.sender_name} className="w-full h-full object-cover" />
                        : msg.sender_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${!msg.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {clientProfiles[msg.sender_user_id]?.display_name || msg.sender_name}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {new Date(msg.last_activity_at || msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-sm truncate flex-1 ${!msg.read ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {msg.latest_preview || msg.message}
                      </p>
                      {!msg.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#00267F' }} />}
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
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <EnvelopeIcon className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Select a conversation to read it here.</p>
            </div>
          )}
        </section>

        {/* RIGHT — contact details pane */}
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
                ? <>This will permanently delete the entire conversation with <span className="font-semibold text-gray-700">{deleteConfirmMsg[0].sender_name}</span>.</>
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

      {/* Quote builder */}
      {quoteMsg && (
        <div className="fixed inset-0 z-[200] bg-gray-50 overflow-y-auto">

          {/* Builder header */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 no-print">
            <div>
              <h2 className="font-bold text-gray-900">Create quote</h2>
              <p className="text-xs text-gray-400 mt-0.5">For {quoteClientName} · {quoteMsg.subject}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Desktop action buttons — hidden on mobile, shown at bottom instead */}
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={saveQuoteInApp}
                  disabled={quoteSaving}
                  className="px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#00267F' }}
                >
                  {quoteSaving ? 'Sending…' : 'Send in-app'}
                </button>
                <button
                  onClick={sendQuoteToClient}
                  className="px-4 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity border"
                  style={{ borderColor: '#00267F', color: '#00267F' }}
                >
                  Send via email
                </button>
                <button
                  onClick={printQuote}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                >
                  Download PDF
                </button>
              </div>
              <button
                onClick={() => setQuoteMsg(null)}
                className="px-4 py-2.5 rounded-full text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* Left — form */}
            <div className="flex flex-col gap-6 no-print">

              {/* Client info */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Client details</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client name</label>
                    <input type="text" value={quoteClientName} onChange={e => setQuoteClientName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client email</label>
                    <input type="email" value={quoteClientEmail} onChange={e => setQuoteClientEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Quote number</h3>
                <input
                  type="text"
                  value={quoteNumber}
                  onChange={e => setQuoteNumber(e.target.value)}
                  placeholder="e.g. QT-20260327-001"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-2">Auto-generated. Edit as needed.</p>
              </div>

              {/* Dates & terms */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Date & payment terms</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quote date</label>
                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Payment terms</label>
                    <select value={quotePaymentTerms} onChange={e => setQuotePaymentTerms(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
                      {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                    Due date: <span className="font-semibold text-gray-600">{quoteDueDate()}</span>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Services / line items</h3>
                {freelancerServices.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Add from your services:</p>
                    <div className="flex flex-wrap gap-2">
                      {freelancerServices.map(svc => (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => addServiceToQuote(svc)}
                          className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors hover:border-gray-400"
                          style={{ borderColor: '#00267F', color: '#00267F' }}
                        >
                          + {svc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {quoteItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-6">
                        {i === 0 && <p className="text-xs text-gray-400 mb-1">Description</p>}
                        <input type="text" placeholder="e.g. Full house rewire" value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white" />
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <p className="text-xs text-gray-400 mb-1">Qty</p>}
                        <input type="number" min="1" value={item.qty}
                          onChange={e => updateItem(i, 'qty', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white text-center" />
                      </div>
                      <div className="col-span-3">
                        {i === 0 && <p className="text-xs text-gray-400 mb-1">Price ($)</p>}
                        <input type="number" placeholder="0.00" value={item.price}
                          onChange={e => updateItem(i, 'price', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white" />
                      </div>
                      <div className="col-span-1 flex items-end pb-1">
                        {i === 0 && <div className="h-5 mb-1" />}
                        {quoteItems.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none w-full flex items-center justify-center pt-1.5">×</button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addItem} className="text-xs font-medium hover:opacity-80 transition-opacity text-left mt-1" style={{ color: '#00267F' }}>
                    + Add line item
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm">Notes (optional)</h3>
                <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)}
                  rows={3} placeholder="e.g. Price excludes materials. A 50% deposit is required before work begins."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white resize-none" />
              </div>

            </div>

            {/* Right — live preview (also the printable doc) */}
            <div id="quote-preview" className="bg-white rounded-2xl border border-gray-100 p-8 h-fit print-area">

              {/* Quote header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                      {profile?.name?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900 text-base">{(profile?.company_name?.trim().length > 3 ? profile.company_name : null) || profile?.name}</p>
                    {profile?.company_name?.trim().length > 3 && <p className="text-sm text-gray-500">{profile?.name}</p>}
                    <p className="text-sm text-gray-500">{profile?.trade}</p>
                    <p className="text-xs text-gray-400">{formatParish(profile?.location)}</p>
                    {profile?.email && <p className="text-xs text-gray-400">{profile.email}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: '#00267F' }}>QUOTE</p>
                  <p className="text-xs text-gray-400 mt-1">{quoteNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(quoteDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Gold divider */}
              <div className="h-0.5 mb-6 rounded-full" style={{ backgroundColor: '#F9C000' }} />

              {/* Billed to */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Billed to</p>
                <p className="font-semibold text-gray-900">{quoteClientName || 'Client name'}</p>
                <p className="text-sm text-gray-500">{quoteClientEmail}</p>
              </div>

              {/* Line items table */}
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
                  {quoteItems.map((item, i) => (
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

              {/* Total */}
              <div className="flex justify-end mb-6">
                <div className="w-48">
                  <div className="flex justify-between py-2 border-t border-gray-200">
                    <span className="text-sm text-gray-500">Subtotal</span>
                    <span className="text-sm font-medium text-gray-900">${quoteTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-1">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span className="text-sm font-bold" style={{ color: '#00267F' }}>${quoteTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment terms */}
              <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#EEF2FF' }}>
                <p className="text-xs font-semibold text-gray-700 mb-0.5">Payment due</p>
                <p className="text-sm font-bold" style={{ color: '#00267F' }}>{quoteDueDate()}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {quotePaymentTerms === 'due_receipt' ? 'Payment due upon receipt' : `${quotePaymentTerms.replace('net','Net ')} from invoice date`}
                </p>
              </div>

              {/* Notes */}
              {quoteNotes && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{quoteNotes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-100 mt-6 pt-4 text-center">
                <p className="text-xs text-gray-400">Generated via <span className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</span> · Connecting Barbados</p>
              </div>

            </div>
          </div>

          {/* Mobile action buttons — visible below content on small screens, hidden on desktop */}
          <div className="lg:hidden max-w-5xl mx-auto px-4 sm:px-6 pb-10 no-print flex flex-col gap-3">
            <button
              onClick={saveQuoteInApp}
              disabled={quoteSaving}
              className="w-full py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#00267F' }}
            >
              {quoteSaving ? 'Sending…' : 'Send in-app'}
            </button>
            <button
              onClick={sendQuoteToClient}
              className="w-full py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity border"
              style={{ borderColor: '#00267F', color: '#00267F' }}
            >
              Send via email
            </button>
            <button
              onClick={printQuote}
              className="w-full py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#F9C000', color: '#00267F' }}
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Quote viewer modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-20" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setViewingQuote(null)}>
          <div id="quote-view-doc" className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100vh-100px)] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>

            {/* Close button */}
            <button
              onClick={() => setViewingQuote(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-start justify-between mb-6 no-print-close">
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                    {profile?.name?.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{(profile?.company_name?.trim().length > 3 ? profile.company_name : null) || profile?.name}</p>
                  <p className="text-sm text-gray-500">{profile?.trade}</p>
                  <p className="text-xs text-gray-400">{profile?.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: '#00267F' }}>QUOTE</p>
                <p className="text-xs text-gray-400 mt-1">{viewingQuote.quote_number}</p>
                <p className="text-xs text-gray-400">{formatDocDate(viewingQuote.quote_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <div className="h-0.5 mb-6 rounded-full" style={{ backgroundColor: '#F9C000' }} />

            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Billed to</p>
              <p className="font-semibold text-gray-900">{viewingQuote.client_name}</p>
              <p className="text-sm text-gray-500">{viewingQuote.client_email}</p>
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
                {(viewingQuote.items || []).map((item, i) => (
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
                  <span className="text-sm font-medium text-gray-900">${Number(viewingQuote.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-gray-900 mt-1">
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(viewingQuote.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#EEF2FF' }}>
              <p className="text-xs font-semibold text-gray-700 mb-0.5">Payment due</p>
              <p className="text-sm font-bold" style={{ color: '#00267F' }}>{formatDocDate(viewingQuote.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {viewingQuote.notes?.trim() && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-gray-600 leading-relaxed">{viewingQuote.notes}</p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 text-center mb-6">
              <p className="text-xs text-gray-400">Generated via <span className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</span> · Connecting Barbados</p>
            </div>

            <div className="flex gap-3 no-print">
              <button onClick={() => setViewingQuote(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
                Close
              </button>
              <button
                onClick={() => printViewingQuote(viewingQuote)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#F9C000', color: '#00267F' }}
              >
                Download PDF
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Toasts */}
      {(quoteToast || toast) && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] px-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg pointer-events-none"
          style={{ backgroundColor: toast?.isError ? '#DC2626' : '#00267F' }}
        >
          {quoteToast || toast?.msg}
        </div>
      )}
    </main>
  )
}
