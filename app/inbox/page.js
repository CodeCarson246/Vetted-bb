'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatParish } from '@/lib/formatParish'

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
  const [replyMenuOpen, setReplyMenuOpen] = useState(null)
  const [replyDeleteConfirm, setReplyDeleteConfirm] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmDeleteReplyId, setConfirmDeleteReplyId] = useState(null)
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null)
  const [deletingThread, setDeletingThread] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDeleteQuoteId, setConfirmDeleteQuoteId] = useState(null)

  const unreadCount = messages.filter(m => !m.read).length

  useEffect(() => {
    if (!replyMenuOpen) return
    function close() { setReplyMenuOpen(null) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [replyMenuOpen])

  useEffect(() => {
    const handleClick = () => setOpenMenuId(null)
    if (openMenuId) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  const { user: authUser, loading: authLoading } = useAuth()

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
        .select('id, name, avatar_url, trade, company_name, location, email')
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
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('freelancer_id', p.id)
          .order('created_at', { ascending: false })

        const messageList = msgs || []
        if (messageList.length > 0) {
          // Fetch the latest reply timestamp for each thread so we can sort by
          // most recent activity (original message or any reply), not just send date
          const { data: latestReplies } = await supabase
            .from('message_replies')
            .select('message_id, created_at')
            .in('message_id', messageList.map(m => m.id))
            .order('created_at', { ascending: false })

          const latestReplyAt = {}
          ;(latestReplies || []).forEach(r => {
            if (!latestReplyAt[r.message_id]) latestReplyAt[r.message_id] = r.created_at
          })

          const enriched = messageList
            .map(m => ({ ...m, last_activity_at: latestReplyAt[m.id] || m.created_at }))
            .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
          setMessages(enriched)
        } else {
          setMessages([])
        }
      }

      setLoading(false)
    }
    init()
  }, [authUser, authLoading, router])

  function openQuote(msg) {
    setQuoteMsg(msg)
    setQuoteClientName(msg.sender_name || '')
    setQuoteClientEmail(msg.sender_email || '')
    setQuoteItems([{ description: '', qty: 1, price: '' }])
    const now = new Date()
    const ast = new Date(now.getTime() - (4 * 60 * 60 * 1000))
    const astDate = ast.toISOString().split('T')[0]
    setQuoteDate(astDate)
    setQuotePaymentTerms('net14')
    setQuoteNotes('')
    setQuoteNumber(`QT-${astDate.replace(/-/g, '').slice(0, 8)}-${Math.floor(Math.random()*900)+100}`)
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
    const terms = { 'due_receipt': 0, 'net7': 7, 'net14': 14, 'net30': 30, 'net60': 60 }
    const days = terms[quotePaymentTerms] ?? 14
    base.setDate(base.getDate() + days)
    return base.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function updateItem(index, field, value) {
    setQuoteItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addServiceToQuote(service) {
    const price = parseFloat(service.price?.replace(/[^0-9.]/g, '')) || ''
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
    const total = Number(q.total).toFixed(2)
    const pValidCompanyName = profile?.company_name?.trim().length > 3 ? profile.company_name : null
    const itemRows = (q.items||[]).map((item,i)=>`<tr><td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.description||'—'}</td><td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.qty}</td><td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+parseFloat(item.price).toFixed(2):'—'}</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;background:${i%2===0?'#ffffff':'#f9fafb'}">${item.price?'$'+((parseFloat(item.price)||0)*(parseInt(item.qty)||1)).toFixed(2):'—'}</td></tr>`).join('')
    const avatarHtml = profile?.avatar_url
      ? `<img src="${profile.avatar_url}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block"/>`
      : `<div style="width:56px;height:56px;border-radius:50%;background:#00267F;color:white;font-size:18px;font-weight:700;text-align:center;line-height:56px">${(profile?.name||'?').split(' ').map(n=>n[0]).join('')}</div>`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Quote-${q.quote_number}-${q.client_name}</title><style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:white;color:#111827;padding:40px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:1.2cm;size:A4;}table{border-collapse:collapse;}</style></head><body>
<table width="100%" style="margin-bottom:28px"><tr><td style="vertical-align:top;width:50%"><table><tr><td style="vertical-align:top;padding-right:14px">${avatarHtml}</td><td style="vertical-align:top"><div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:2px">${pValidCompanyName||profile?.name||''}</div>${pValidCompanyName?`<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${profile?.name}</div>`:''}<div style="font-size:13px;color:#6b7280;margin-bottom:1px">${profile?.trade||''}</div><div style="font-size:12px;color:#9ca3af;margin-bottom:1px">${formatParish(profile?.location)||''}</div>${profile?.email?`<div style="font-size:12px;color:#9ca3af">${profile.email}</div>`:''}</td></tr></table></td><td style="vertical-align:top;text-align:right;width:50%"><div style="font-size:34px;font-weight:800;color:#00267F;letter-spacing:4px;line-height:1">QUOTE</div><div style="font-size:12px;color:#9ca3af;margin-top:6px">${q.quote_number}</div><div style="font-size:12px;color:#9ca3af;margin-top:2px">${new Date(q.quote_date + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div></td></tr></table>
<table width="100%" style="margin-bottom:24px"><tr><td style="background:#F9C000;height:3px;font-size:0">&nbsp;</td></tr></table>
<div style="margin-bottom:24px"><div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Billed to</div><div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:3px">${q.client_name}</div><div style="font-size:13px;color:#6b7280">${q.client_email}</div></div>
<table width="100%" style="border-collapse:collapse;margin-bottom:20px"><thead><tr style="background:#00267F"><th style="padding:10px 14px;text-align:left;color:white;font-size:12px;font-weight:600">Description</th><th style="padding:10px 14px;text-align:center;color:white;font-size:12px;font-weight:600;width:60px">Qty</th><th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Unit price</th><th style="padding:10px 14px;text-align:right;color:white;font-size:12px;font-weight:600;width:100px">Total</th></tr></thead><tbody>${itemRows}</tbody></table>
<table width="100%" style="margin-bottom:24px"><tr><td width="60%"></td><td width="40%"><table width="100%"><tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Subtotal</td><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right">$${total}</td></tr><tr><td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#111827">Total</td><td style="padding:10px 0;border-top:2px solid #111827;font-size:14px;font-weight:700;color:#00267F;text-align:right">$${total}</td></tr></table></td></tr></table>
<table width="100%" style="margin-bottom:24px"><tr><td style="background:#EEF2FF;border-radius:10px;padding:16px 18px"><div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Payment due</div><div style="font-size:16px;font-weight:700;color:#00267F;margin-bottom:3px">${new Date(q.due_date + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div></td></tr></table>
${q.notes?.trim()?`<table width="100%" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb;padding-top:16px"><div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Notes</div><div style="font-size:13px;color:#374151;line-height:1.7">${q.notes}</div></td></tr></table>`:''}
<table width="100%"><tr><td style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center"><div style="font-size:11px;color:#9ca3af">Generated via <span style="color:#00267F;font-weight:600">Vetted.bb</span> &middot; Connecting Barbados</div></td></tr></table>
</body></html>`
    const printFrame = document.createElement('iframe')
    printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;'
    document.body.appendChild(printFrame)
    const doc = printFrame.contentDocument||printFrame.contentWindow.document
    doc.open(); doc.write(html); doc.close()
    printFrame.contentWindow.focus()
    setTimeout(()=>{printFrame.contentWindow.print();setTimeout(()=>document.body.removeChild(printFrame),1500)},800)
  }

  async function saveQuoteInApp() {
    const [qy, qm, qd] = quoteDate.split('-').map(Number)
    const terms = { 'due_receipt': 0, 'net7': 7, 'net14': 14, 'net30': 30, 'net60': 60 }
    const days = terms[quotePaymentTerms] ?? 14
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
      return
    }

    await supabase.from('message_replies').insert({
      message_id: quoteMsg.id,
      sender_name: profile.name,
      sender_user_id: user?.id,
      body: `__QUOTE__${savedQuote.id}`,
    })

    const recipientName = quoteClientName
    setQuoteMsg(null)
    setQuoteToast(`Quote sent to ${recipientName}`)
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

  async function sendReply(msg) {
    const text = replyText[msg.id]?.trim()
    if (!text) return
    setReplySending(true)
    const { data, error } = await supabase
      .from('message_replies')
      .insert({
        message_id: msg.id,
        sender_name: profile.name,
        sender_user_id: user?.id,
        body: text,
      })
      .select()
      .single()
    if (!error) {
      setReplies(prev => ({ ...prev, [msg.id]: [...(prev[msg.id] || []), data] }))
      setReplyText(prev => ({ ...prev, [msg.id]: '' }))
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
    }
    const { data: r } = await supabase
      .from('message_replies')
      .select('*')
      .eq('message_id', msg.id)
      .order('created_at', { ascending: true })
    setReplies(prev => ({ ...prev, [msg.id]: r || [] }))
    const quoteIds = (r || [])
      .filter(rep => rep.body.startsWith('__QUOTE__'))
      .map(rep => rep.body.replace('__QUOTE__', ''))
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

  async function deleteConversation(msg) {
    setDeletingThread(true)
    setDeleteConfirmMsg(null)
    // Optimistic remove from list
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    if (expandedId === msg.id) setExpandedId(null)

    // Supabase: DELETE FROM quotes WHERE message_id = msg.id
    await supabase.from('quotes').delete().eq('message_id', msg.id)
    // Supabase: DELETE FROM message_replies WHERE message_id = msg.id
    await supabase.from('message_replies').delete().eq('message_id', msg.id)
    // Supabase: DELETE FROM messages WHERE id = msg.id
    const { error } = await supabase.from('messages').delete().eq('id', msg.id)

    if (error) {
      // Restore on failure
      setMessages(prev =>
        [...prev, msg].sort((a, b) =>
          new Date(b.last_activity_at || b.created_at) - new Date(a.last_activity_at || a.created_at)
        )
      )
      showToast('Failed to delete conversation. Please try again.', true)
    } else {
      showToast('Conversation deleted')
    }
    setDeletingThread(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          {unreadCount > 0 && (
            <span className="text-sm text-gray-500">{unreadCount} unread</span>
          )}
        </div>

        {!profile ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
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
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => handleExpand(msg)}
                className={`group bg-white rounded-2xl border transition-all cursor-pointer ${expandedId === msg.id ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                      {msg.sender_name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${!msg.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                            {msg.sender_name}
                          </span>
                          {!msg.read && (
                            <span className="text-xs text-white px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#00267F' }}>
                              Unread
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-gray-400">
                            {new Date(msg.last_activity_at || msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirmMsg(msg) }}
                            className="p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
                            title="Delete conversation"
                            aria-label="Delete conversation"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 mt-0.5">{msg.sender_email}</p>
                      <p className={`text-sm mt-1 ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {msg.subject}
                      </p>

                      {expandedId !== msg.id && (
                        <p className="text-sm text-gray-500 mt-1">
                          {msg.message.length > 100 ? msg.message.slice(0, 100) + '…' : msg.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {expandedId === msg.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 ml-14">
                      <div className="flex justify-end mb-3">
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirmMsg(msg) }}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1 py-1"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>
                          </svg>
                          Delete conversation
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      {/* Previous replies */}
                      {(replies[msg.id] || []).length > 0 && (
                        <div className="mt-4 flex flex-col gap-3">
                          {(replies[msg.id] || []).map(r => {
                            const isQuote = r.body.startsWith('__QUOTE__')
                            const quoteId = isQuote ? r.body.replace('__QUOTE__', '') : null
                            const quoteData = quoteId ? (threadQuotes[quoteId] || null) : null
                            if (isQuote && quoteData) {
                              return (
                                <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                  <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#00267F' }}>
                                    <div>
                                      <p className="text-white font-semibold text-sm">Quote {quoteData.quote_number}</p>
                                      <p className="text-xs mt-0.5" style={{ color: '#93b8ff' }}>From {r.sender_name} · {new Date(quoteData.quote_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <button
                                      onClick={e => { e.stopPropagation(); setViewingQuote(quoteData) }}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                                      style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                                    >
                                      View & download
                                    </button>
                                  </div>
                                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(quoteData.total).toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Payment due</p>
                                        <p className="text-sm font-semibold text-gray-700">{new Date(quoteData.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                                        {quoteData.status}
                                      </span>
                                      {confirmDeleteQuoteId === quoteData.id ? (
                                        <span className="text-xs text-gray-500 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                          Delete?{' '}
                                          <button onClick={e => { e.stopPropagation(); handleDeleteQuote(quoteData.id, r.id) }} className="text-red-600 font-semibold hover:text-red-800">Yes</button>
                                          {' · '}
                                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteQuoteId(null) }} className="text-gray-500 font-semibold hover:text-gray-700">No</button>
                                        </span>
                                      ) : (
                                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteQuoteId(quoteData.id) }} className="text-xs text-red-500 hover:text-red-700">
                                          Delete quote
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            // Primary: UUID match (new replies). Fallback: name match (old replies where sender_user_id is NULL).
                            const isOwnReply = !!(
                              (r.sender_user_id && user?.id && r.sender_user_id === user.id) ||
                              (!r.sender_user_id && r.sender_name === profile?.name)
                            )
                            return (
                              <div key={r.id} className="flex items-start gap-3 group/reply">
                                {r._deleted ? (
                                  <>
                                    <div className="w-7 h-7 flex-shrink-0" />
                                    <p className="text-sm italic text-gray-400 py-1">Message deleted</p>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                                      {r.sender_name[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                                      <p className="text-xs font-semibold text-gray-700 mb-1">{r.sender_name}</p>
                                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                                      <p className="text-xs text-gray-400 mt-1.5">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                      {isOwnReply && (
                                        confirmDeleteReplyId === r.id ? (
                                          <span className="text-xs text-gray-500 mt-1.5 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            Delete this reply?{' '}
                                            <button onClick={e => { e.stopPropagation(); handleDeleteReply(r.id) }} className="text-red-600 font-semibold hover:text-red-800">Yes</button>
                                            {' · '}
                                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteReplyId(null) }} className="text-gray-500 font-semibold hover:text-gray-700">No</button>
                                          </span>
                                        ) : (
                                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteReplyId(r.id) }} className="text-xs text-red-500 hover:text-red-700 mt-1.5 block">
                                            Delete
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Reply box */}
                      <div className="mt-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        <textarea
                          value={replyText[msg.id] || ''}
                          onChange={e => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))}
                          placeholder="Write a reply..."
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={e => { e.stopPropagation(); openQuote(msg) }}
                            className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity flex-shrink-0"
                            style={{ backgroundColor: '#00267F' }}
                          >
                            Create quote →
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); sendReply(msg) }}
                            disabled={replySending || !replyText[msg.id]?.trim()}
                            className="text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                          >
                            {replySending ? 'Sending...' : 'Send reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete conversation confirmation modal */}
      {deleteConfirmMsg && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDeleteConfirmMsg(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-base mb-2">Delete this conversation?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete the entire conversation with <span className="font-semibold text-gray-700">{deleteConfirmMsg.sender_name}</span>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmMsg(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteConversation(deleteConfirmMsg)}
                disabled={deletingThread}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#DC2626' }}
              >
                {deletingThread ? 'Deleting…' : 'Delete conversation'}
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
                  className="px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Send in-app
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
                      <option value="due_receipt">Due on receipt</option>
                      <option value="net7">Net 7 days</option>
                      <option value="net14">Net 14 days</option>
                      <option value="net30">Net 30 days</option>
                      <option value="net60">Net 60 days</option>
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
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white' }}>
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
              className="w-full py-3 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Send in-app
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
                <p className="text-xs text-gray-400">{new Date(viewingQuote.quote_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : 'white' }}>
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
              <p className="text-sm font-bold" style={{ color: '#00267F' }}>{new Date(viewingQuote.due_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
