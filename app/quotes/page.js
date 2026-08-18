'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { printSavedQuote } from '@/lib/printQuote'
import { formatDocDate } from '@/lib/formatDate'
import { PAYMENT_TERMS, reminderThreshold, daysUntil, termLabel } from '@/lib/paymentTerms'

// Lifecycle: sent → accepted → invoiced → completed → paid (declined terminal)
const STATUS_STYLES = {
  sent:      { backgroundColor: '#EEF2FF', color: '#00267F' },
  accepted:  { backgroundColor: '#DCFCE7', color: '#166534' },
  declined:  { backgroundColor: '#FEE2E2', color: '#991B1B' },
  invoiced:  { backgroundColor: '#FEF3C7', color: '#92400E' },
  completed: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  paid:      { backgroundColor: '#DCFCE7', color: '#166534' },
}

const STATUS_LABELS = {
  sent: 'Awaiting reply',
  accepted: 'Accepted',
  declined: 'Declined',
  invoiced: 'Invoiced',
  completed: 'Job completed',
  paid: 'Paid ✓',
}

const INVOICE_TERMS = PAYMENT_TERMS

function StatusChip({ status }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
      style={STATUS_STYLES[status] || STATUS_STYLES.sent}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}

/** Tick box for lifecycle steps — every change goes through a confirm popup. */
function CheckRow({ label, sublabel, checked, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex items-center gap-3 text-left w-full group disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span
        className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors"
        style={checked
          ? { backgroundColor: '#16a34a', borderColor: '#16a34a' }
          : { borderColor: '#d1d5db', backgroundColor: 'var(--surface-card)' }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="flex-1">
        <span className={`text-sm font-medium block ${checked ? 'text-gray-900' : 'text-gray-600 group-hover:text-gray-900'} transition-colors`}>{label}</span>
        {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
      </span>
    </button>
  )
}

/** Horizontal bar list for the earnings breakdowns. */
function BarList({ rows, accent = '#00267F' }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Nothing here yet.</p>
  }
  const max = Math.max(...rows.map(r => r.value))
  return (
    <div className="flex flex-col gap-3">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm text-gray-700 truncate">{r.label}</span>
            <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: '#00267F' }}>${r.value.toFixed(0)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%`, backgroundColor: accent }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const CHART_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Round a max value up to a clean axis ceiling (e.g. 1340 -> 1500).
function niceCeil(v) {
  if (v <= 0) return 100
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

// Bucket paid transactions into a time series for the earnings chart.
//  '30d'  -> one point per day for the last 30 days
//  '12m'  -> one point per month for the last 12 months
function chartSeriesFor(tx, range) {
  const now = new Date()
  const out = []
  if (range === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      const value = tx.reduce((s, t) => (t.date >= d && t.date < next ? s + t.amount : s), 0)
      out.push({ value, label: d.getDate() === 1 || i === 29 || i === 0 ? `${CHART_MONTHS[d.getMonth()]} ${d.getDate()}` : '', full: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const value = tx.reduce((s, t) => (t.date >= d && t.date < next ? s + t.amount : s), 0)
      out.push({ value, label: `${CHART_MONTHS[d.getMonth()]}${d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}`, full: `${CHART_MONTHS[d.getMonth()]} ${d.getFullYear()}` })
    }
  }
  return out
}

/** Area + line chart for earnings over time (real paid invoices). */
function EarningsChart({ series }) {
  const W = 740, H = 240, padL = 48, padR = 14, padT = 14, padB = 30
  const n = series.length
  const rawMax = Math.max(0, ...series.map(s => s.value))
  const max = niceCeil(rawMax)
  const x = i => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const y = v => padT + (1 - v / max) * (H - padT - padB)
  const pts = series.map((s, i) => [x(i), y(s.value)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
  const ticks = [0, max / 2, max]
  const fmtTick = v => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(v)}`
  if (rawMax === 0) {
    return <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">No earnings in this period.</div>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Earnings over time">
      <defs>
        <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F9C000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#F9C000" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#eef0f4" strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{fmtTick(t)}</text>
        </g>
      ))}
      <path d={area} fill="url(#earnFill)" />
      <path d={line} fill="none" stroke="#F9C000" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => series[i].value > 0 ? <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#F9C000" strokeWidth="2" /> : null)}
      {series.map((s, i) => s.label ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{s.label}</text> : null)}
    </svg>
  )
}

function fmtDate(str) {
  return formatDocDate(str) || ''
}

export default function QuotesPage() {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [quoteSort, setQuoteSort] = useState('newest') // 'newest' | 'oldest'
  const [quoteYear, setQuoteYear] = useState('all')
  const [quoteMonth, setQuoteMonth] = useState('all')
  const [invoicingId, setInvoicingId] = useState(null)
  const [invoiceTerms, setInvoiceTerms] = useState('net14')
  const [busyId, setBusyId] = useState(null)
  const [view, setView] = useState('quotes')
  const [confirmAction, setConfirmAction] = useState(null)
  const [toast, setToast] = useState(null)
  const [selYear, setSelYear] = useState('all')
  const [selMonth, setSelMonth] = useState('all')
  const [selService, setSelService] = useState('all')
  const [selClient, setSelClient] = useState('all')
  const [venture, setVenture] = useState('all')  // page-wide business scope
  const [remindedIds, setRemindedIds] = useState(() => new Set())
  const [receiptSentIds, setReceiptSentIds] = useState(() => new Set())
  const [chartRange, setChartRange] = useState('12m') // '30d' | '12m'

  useEffect(() => {
    if (authLoading) return
    if (!authUser) { router.push('/login'); return }

    async function load() {
      const { data: p } = await supabase
        .from('freelancers')
        .select('id, name, company_name, trade, location, email, avatar_url, ventures')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (!p) {
        // Not a freelancer — quotes live in their messages instead
        router.push('/messages')
        return
      }
      setProfile(p)

      const { data: qs } = await supabase
        .from('quotes')
        .select('*')
        .eq('freelancer_id', p.id)
        .order('created_at', { ascending: false })
      setQuotes(qs || [])
      setLoading(false)
    }
    load()
  }, [authUser, authLoading, router])

  // Notify the client of a quote lifecycle event (fire-and-forget)
  function notifyQuoteEvent(quoteId, event) {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) fetch('/api/notify-quote-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quote_id: quoteId, event }),
      }).catch(() => {})
    })
  }

  async function updateStatus(quoteId, status, extra = {}) {
    setBusyId(quoteId)
    const patch = { status, ...extra }
    // Marking a job PAID inherently confirms it's done — auto-set the
    // freelancer's completion if they hadn't ticked it, so the client isn't
    // blocked from reviewing (the gate needs both completions + paid).
    if (patch.paid_at && status === 'paid') {
      const q = quotes.find(x => x.id === quoteId)
      if (q && !q.completed_at && !patch.completed_at) patch.completed_at = patch.paid_at
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId)
    if (!error) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, ...patch } : q))
      // Mark transitions (not undos) notify the client
      if (patch.paid_at) notifyQuoteEvent(quoteId, 'paid')
      else if (patch.completed_at) notifyQuoteEvent(quoteId, 'completed')
    }
    setBusyId(null)
  }

  // Send the accepted quote as a formal invoice with its own number,
  // issue date and payment terms.
  async function sendInvoice(q) {
    setBusyId(q.id)
    const terms = INVOICE_TERMS.find(t => t.value === invoiceTerms) || INVOICE_TERMS[2]
    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + terms.days)
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900) + 100}`

    const patch = {
      status: 'invoiced',
      invoice_number: invoiceNumber,
      invoiced_at: now.toISOString(),
      invoice_terms: terms.value,
      invoice_due_date: dueStr,
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', q.id)
    if (error) {
      alert('Could not send the invoice. Please try again.')
      setBusyId(null)
      return
    }
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, ...patch } : x))
    setInvoicingId(null)

    // Note it in the conversation and notify the client
    if (q.message_id) {
      supabase.from('messages').update({ client_read: false }).eq('id', q.message_id).then(() => {})
      // quote_id makes the client see a downloadable invoice card, not
      // just a text line.
      supabase.from('message_replies').insert({
        message_id: q.message_id,
        sender_name: profile.name,
        sender_user_id: authUser?.id,
        quote_id: q.id,
        body: `Sent invoice ${invoiceNumber}, payment due ${fmtDate(dueStr)} (${terms.label.toLowerCase()})`,
      }).then(() => {})
      fetch('/api/notify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: q.message_id,
          kind: 'invoice',
          message: `Invoice ${invoiceNumber} for $${Number(q.total).toFixed(2)}, payment due ${fmtDate(dueStr)}`,
        }),
      }).catch(() => {})
    }
    setBusyId(null)
  }

  // A job's status reflects MUTUAL completion: 'completed' only when
  // both the freelancer (completed_at) and client (client_completed_at)
  // have confirmed. 'paid' is terminal and preserved regardless.
  function deriveStatus(q, freelancerDone, paid) {
    if (paid) return 'paid'
    return (freelancerDone && q.client_completed_at) ? 'completed' : 'invoiced'
  }

  // Lifecycle tickboxes — every change is confirmed in a popup, and
  // unticking reverts an accidental click.
  function requestCompletedToggle(q) {
    const done = !!q.completed_at
    if (done) {
      setConfirmAction({
        title: 'Undo your completion?',
        body: 'This removes your confirmation that the job is finished.',
        confirmLabel: 'Undo',
        onConfirm: () => updateStatus(q.id, deriveStatus(q, false, q.status === 'paid'), { completed_at: null }),
      })
    } else {
      setConfirmAction({
        title: 'Mark the job as completed?',
        body: q.client_completed_at
          ? `${q.client_name || 'The client'} has already confirmed. This completes the job for both of you.`
          : `Confirm the work for ${q.client_name || 'this client'} is finished. The client also confirms on their side before reviews open.`,
        confirmLabel: 'Job completed',
        onConfirm: () => updateStatus(q.id, deriveStatus(q, true, q.status === 'paid'), { completed_at: new Date().toISOString() }),
      })
    }
  }

  function requestPaidToggle(q) {
    if (q.status === 'paid') {
      setConfirmAction({
        title: 'Undo payment?',
        body: `${q.invoice_number || q.quote_number} will be marked unpaid and $${Number(q.total).toFixed(2)} removed from your earnings.`,
        confirmLabel: 'Mark unpaid',
        onConfirm: () => updateStatus(q.id, deriveStatus(q, !!q.completed_at, false), { paid_at: null }),
      })
    } else {
      setConfirmAction({
        title: 'Confirm payment received?',
        body: `$${Number(q.total).toFixed(2)} from ${q.client_name || 'this client'} will be added to your earnings.`,
        confirmLabel: 'Payment received',
        onConfirm: () => updateStatus(q.id, 'paid', { paid_at: new Date().toISOString() }),
      })
    }
  }

  function flash(msg, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3200)
  }

  function confirmDeleteInvoice(q) {
    const label = q.invoice_number ? 'invoice' : 'quote'
    const ref = q.invoice_number || q.quote_number
    const earningsNote = q.status === 'paid' ? ' and removed from your earnings' : ''
    setConfirmAction({
      title: `Delete this ${label}?`,
      body: `${ref} for $${Number(q.total).toFixed(2)} from ${q.client_name || 'this client'} will be permanently deleted${earningsNote}, along with its card in the conversation. This cannot be undone.`,
      confirmLabel: `Delete ${label}`,
      danger: true,
      onConfirm: () => deleteInvoice(q),
    })
  }

  async function deleteInvoice(q) {
    setBusyId(q.id)
    // Remove the quote/invoice/receipt cards from the conversation first, then
    // the quote itself. Both are the freelancer's own rows, so RLS permits it
    // ("Freelancers manage own quotes" + "Authors can delete own replies").
    await supabase.from('message_replies').delete().eq('quote_id', q.id)
    const { error } = await supabase.from('quotes').delete().eq('id', q.id)
    setBusyId(null)
    if (error) { flash('Could not delete the invoice. Please try again.', true); return }
    setQuotes(prev => prev.filter(x => x.id !== q.id))
    flash('Invoice deleted and removed from earnings.')
  }

  // Ventures to offer: the canonical list on the profile, plus any group
  // already stamped on a quote (covers quotes filed before a venture was
  // renamed or removed, so their history stays reachable).
  const ventureOptions = [...new Set([
    ...(profile?.ventures || []),
    ...quotes.map(q => q.business_group).filter(Boolean),
  ])].sort()
  const hasVentures = ventureOptions.length > 0
  // Quotes carry business_group once filed. 'none' surfaces the ones not
  // tied to any venture so they never become invisible.
  const matchesVenture = q => venture === 'all'
    || (venture === 'none' ? !q.business_group : q.business_group === venture)

  const byVenture = hasVentures ? quotes.filter(matchesVenture) : quotes
  const filtered = filter === 'all' ? byVenture : byVenture.filter(q => q.status === filter)

  // Quotes-list month/year filter + sort (by quote date, falling back to created)
  const quoteDateOf = q => q.quote_date || q.created_at || ''
  const quoteYearOptions = [...new Set(quotes.map(q => quoteDateOf(q).slice(0, 4)).filter(Boolean))].sort().reverse()
  const MONTH_OPTS = [['01','Jan'],['02','Feb'],['03','Mar'],['04','Apr'],['05','May'],['06','Jun'],['07','Jul'],['08','Aug'],['09','Sep'],['10','Oct'],['11','Nov'],['12','Dec']]
  const displayed = filtered
    .filter(q => {
      const d = quoteDateOf(q)
      if (quoteYear !== 'all' && d.slice(0, 4) !== quoteYear) return false
      if (quoteMonth !== 'all' && d.slice(5, 7) !== quoteMonth) return false
      return true
    })
    .sort((a, b) => {
      const cmp = quoteDateOf(a).localeCompare(quoteDateOf(b))
      return quoteSort === 'oldest' ? cmp : -cmp
    })
  const sumWhere = statuses => byVenture
    .filter(q => statuses.includes(q.status))
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0)
  const totalEarned = sumWhere(['paid'])
  const pendingPayment = sumWhere(['invoiced', 'completed'])
  const pendingCount = byVenture.filter(q => q.status === 'sent').length

  // ── Earnings breakdowns (paid quotes only) ──
  // Earnings are broken down at the LINE-ITEM level so year, month and
  // service filters can combine: "Service A in June", "Service A all
  // year", "everything in 2026", etc.
  const paidQuotes = byVenture.filter(q => q.status === 'paid' && q.paid_at)
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const earningsEntries = []
  for (const q of paidQuotes) {
    const d = new Date(q.paid_at)
    for (const item of q.items || []) {
      const amount = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1)
      if (amount <= 0) continue
      earningsEntries.push({
        year: String(d.getFullYear()),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        // Item descriptions look like "Service name - details" (older data used
        // an em dash); group by the name before the separator.
        service: (item.description || 'Other').split(/ [—-] /)[0].trim().slice(0, 60) || 'Other',
        client: q.client_name?.trim() || q.client_email || 'Client',
        venture: q.business_group || '',
        amount,
      })
    }
  }

  // Dropdown options come from ALL earnings, not the filtered subset
  const yearOptions = [...new Set(earningsEntries.map(e => e.year))].sort().reverse()
  const serviceOptions = [...new Set(earningsEntries.map(e => e.service))].sort()
  const clientOptions = [...new Set(earningsEntries.map(e => e.client))].sort()

  const filteredEntries = earningsEntries.filter(e =>
    (selYear === 'all' || e.year === selYear)
    && (selMonth === 'all' || e.month === selMonth)
    && (selService === 'all' || e.service === selService)
    && (selClient === 'all' || e.client === selClient)
  )
  const filteredTotal = filteredEntries.reduce((sum, e) => sum + e.amount, 0)
  const hasEarningsFilter = selYear !== 'all' || selMonth !== 'all' || selService !== 'all' || selClient !== 'all'
  const filterLabel = [
    selService !== 'all' ? selService : null,
    selClient !== 'all' ? selClient : null,
    selMonth !== 'all' ? MONTHS_LONG[Number(selMonth) - 1] : null,
    selYear !== 'all' ? selYear : null,
  ].filter(Boolean).join(' · ') || 'All earnings'

  function aggregateBy(entries, keyFn, labelFn = k => k) {
    const map = {}
    for (const e of entries) {
      const k = keyFn(e)
      map[k] = (map[k] || 0) + e.amount
    }
    return Object.entries(map).map(([key, value]) => ({ key, label: labelFn(key), value }))
  }

  const byMonth = aggregateBy(
    filteredEntries,
    e => `${e.year}-${e.month}`,
    k => { const [y, m] = k.split('-'); return `${MONTHS_SHORT[Number(m) - 1]} ${y}` },
  ).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 12)

  const byYear = aggregateBy(filteredEntries, e => e.year)
    .sort((a, b) => b.key.localeCompare(a.key))

  const byService = aggregateBy(filteredEntries, e => e.service)
    .sort((a, b) => b.value - a.value).slice(0, 8)

  const byClient = aggregateBy(filteredEntries, e => e.client)
    .sort((a, b) => b.value - a.value).slice(0, 8)

  // ── Trends, time series + transaction feed (real paid invoices) ──
  const paidTx = paidQuotes
    .map(q => ({
      id: q.id,
      ref: q.invoice_number || q.quote_number || '',
      client: q.client_name?.trim() || q.client_email || 'Client',
      title: (q.items?.[0]?.description || '').split(/ [—-] /)[0].trim() || 'Job',
      items: (q.items || []).length,
      date: new Date(q.paid_at),
      amount: Number(q.total) || 0,
      _q: q,
    }))
    .sort((a, b) => b.date - a.date)

  const nowRef = new Date()
  const sumRange = (from, to) => paidTx.reduce((s, t) => (t.date >= from && t.date < to ? s + t.amount : s), 0)
  const startOfMonth = new Date(nowRef.getFullYear(), nowRef.getMonth(), 1)
  const startOfNextMonth = new Date(nowRef.getFullYear(), nowRef.getMonth() + 1, 1)
  const startOfLastMonth = new Date(nowRef.getFullYear(), nowRef.getMonth() - 1, 1)
  const thisMonthTotal = sumRange(startOfMonth, startOfNextMonth)
  const lastMonthTotal = sumRange(startOfLastMonth, startOfMonth)
  const monthDelta = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : null
  const mondayOffset = (nowRef.getDay() + 6) % 7
  const startOfWeek = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate() - mondayOffset)
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  const thisWeekTotal = sumRange(startOfWeek, startOfNextMonth > nowRef ? new Date(nowRef.getTime() + 86400000) : nowRef)
  const lastWeekTotal = sumRange(startOfLastWeek, startOfWeek)
  const weekDelta = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : null
  const paidThisMonth = paidTx.filter(t => t.date >= startOfMonth).length
  const chartSeries = chartSeriesFor(paidTx, chartRange)

  function exportEarningsCsv() {
    const rows = [['Reference', 'Client', 'Job', 'Date paid', 'Amount']]
    for (const t of paidTx) {
      rows.push([t.ref, t.client, t.title, t.date.toISOString().slice(0, 10), t.amount.toFixed(2)])
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vetted-earnings-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Outstanding payments: invoiced but not yet paid ──
  const outstanding = byVenture
    .filter(q => ['invoiced', 'completed'].includes(q.status) && q.invoice_due_date)
    .map(q => ({ ...q, daysLeft: daysUntil(q.invoice_due_date) }))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
  const outstandingTotal = outstanding.reduce((sum, q) => sum + (Number(q.total) || 0), 0)
  const overdueCount = outstanding.filter(q => q.daysLeft !== null && q.daysLeft < 0).length

  // Send a "payment due" reminder to the client (email + push + thread note)
  async function sendReminder(q) {
    setBusyId(q.id)
    const dl = daysUntil(q.invoice_due_date)
    const phrase = dl < 0 ? `was due ${Math.abs(dl)} day${Math.abs(dl) === 1 ? '' : 's'} ago`
      : dl === 0 ? 'is due today'
      : `is due in ${dl} day${dl === 1 ? '' : 's'}`
    const body = `Friendly reminder: invoice ${q.invoice_number} for $${Number(q.total).toFixed(2)} ${phrase} (due ${fmtDate(q.invoice_due_date)}).`

    if (q.message_id) {
      await supabase.from('messages').update({ client_read: false }).eq('id', q.message_id)
      await supabase.from('message_replies').insert({
        message_id: q.message_id,
        sender_name: profile.name,
        sender_user_id: authUser?.id,
        body,
      })
      fetch('/api/notify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: q.message_id, kind: 'reminder', message: body }),
      }).catch(() => {})
    }
    setRemindedIds(prev => new Set(prev).add(q.id))
    setBusyId(null)
  }

  // Send a paid receipt to the client — the invoice re-issued with a PAID
  // stamp and the payment date, for both parties' tax records. Drops a
  // downloadable receipt card into the thread + email + push.
  async function sendReceipt(q) {
    setBusyId(q.id)
    const ref = q.invoice_number || q.quote_number
    const body = `Sent receipt for ${ref} - paid in full on ${fmtDate(q.paid_at)}. Total $${Number(q.total).toFixed(2)}.`
    const sentAt = new Date().toISOString()

    if (q.message_id) {
      await supabase.from('messages').update({ client_read: false }).eq('id', q.message_id)
      // quote_id makes the client see a downloadable receipt card.
      await supabase.from('message_replies').insert({
        message_id: q.message_id,
        sender_name: profile.name,
        sender_user_id: authUser?.id,
        quote_id: q.id,
        body,
      })
      fetch('/api/notify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: q.message_id, kind: 'receipt', message: body }),
      }).catch(() => {})
    }
    // Record when the receipt was sent so the workflow box can show it.
    await supabase.from('quotes').update({ receipt_sent_at: sentAt }).eq('id', q.id)
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, receipt_sent_at: sentAt } : x))
    setReceiptSentIds(prev => new Set(prev).add(q.id))
    setBusyId(null)
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
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Quotes &amp; earnings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track every quote from first send to money in hand.
          </p>
        </div>

        {/* Earnings summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Total earned', value: `$${totalEarned.toFixed(0)}`, accent: '#16a34a' },
            { label: 'Pending payment', value: `$${pendingPayment.toFixed(0)}`, accent: '#F9C000' },
            { label: 'Awaiting reply', value: pendingCount, accent: '#00267F' },
            { label: 'Quotes sent', value: quotes.length, accent: '#00267F' },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 text-center"
              style={{ borderTop: `3px solid ${stat.accent}` }}
            >
              <p className="text-xl sm:text-3xl font-bold mb-1 tabular-nums" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Business switcher — only for pros running more than one venture.
            Scopes the ENTIRE page: the headline stats, the quotes list,
            pending payments and the earnings breakdown all follow it, so a
            pro can read one business's numbers without the others mixed in. */}
        {hasVentures && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 items-center">
            <span className="flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-1">Business</span>
            {['all', ...ventureOptions, 'none'].map(v => (
              <button
                key={v}
                onClick={() => setVenture(v)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${venture === v ? '' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
                style={venture === v ? { backgroundColor: '#F9C000', color: '#00267F' } : {}}
              >
                {v === 'all' ? 'All businesses' : v === 'none' ? 'Unassigned' : v}
              </button>
            ))}
          </div>
        )}

        {/* View switch: quotes · outstanding · earnings */}
        <div className="flex gap-1 mb-6 bg-white rounded-full border border-gray-200 p-1 max-w-full overflow-x-auto no-scrollbar">
          {[['quotes', 'Quotes'], ['outstanding', `Pending payment${outstanding.length ? ` (${outstanding.length})` : ''}`], ['earnings', 'Earnings breakdown']].map(([v, label]) => (
            <button
              key={v}
              onClick={e => { setView(v); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${view === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
              style={view === v ? { backgroundColor: '#00267F' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'outstanding' && (
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center" style={{ borderTop: '3px solid #F9C000' }}>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>${outstandingTotal.toFixed(0)}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Pending payment</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center" style={{ borderTop: `3px solid ${overdueCount ? '#ef4444' : '#00267F'}` }}>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: overdueCount ? '#ef4444' : '#00267F', fontFamily: "'Sora', sans-serif" }}>{overdueCount}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Overdue</p>
              </div>
            </div>

            {outstanding.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <p className="font-medium text-gray-900 mb-1">No outstanding invoices</p>
                <p className="text-sm text-gray-500">Invoices you&apos;ve sent that aren&apos;t paid yet will appear here, with a reminder button as the due date approaches.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {outstanding.map(q => {
                  const dl = q.daysLeft
                  const overdue = dl !== null && dl < 0
                  const showReminder = dl !== null && dl <= reminderThreshold(q.invoice_terms)
                  const dueText = dl === null ? ''
                    : overdue ? `${Math.abs(dl)} day${Math.abs(dl) === 1 ? '' : 's'} overdue`
                    : dl === 0 ? 'Due today'
                    : `${dl} day${dl === 1 ? '' : 's'} left`
                  const dueColor = overdue ? '#ef4444' : dl <= reminderThreshold(q.invoice_terms) ? '#B45309' : '#6B7280'
                  return (
                    <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-5" style={{ borderLeft: `4px solid ${overdue ? '#ef4444' : '#F9C000'}` }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: '#00267F' }}>{q.invoice_number || q.quote_number}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: overdue ? '#FEE2E2' : '#FEF3C7', color: dueColor }}>{dueText}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{q.client_name || 'Client'} · {termLabel(q.invoice_terms)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Due {fmtDate(q.invoice_due_date)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold" style={{ color: '#00267F' }}>${Number(q.total).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {q.invoice_number && (
                          <button onClick={() => printSavedQuote(q, profile, { type: 'invoice' })} className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors" style={{ borderColor: '#00267F', color: '#00267F' }}>
                            Invoice PDF
                          </button>
                        )}
                        {showReminder && (
                          remindedIds.has(q.id) ? (
                            <span className="text-xs font-medium px-3.5 py-1.5 rounded-full" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>Reminder sent ✓</span>
                          ) : (
                            <button
                              onClick={() => sendReminder(q)}
                              disabled={busyId === q.id}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                            >
                              {busyId === q.id ? 'Sending…' : overdue ? 'Send overdue reminder' : 'Send payment reminder'}
                            </button>
                          )
                        )}
                        <button
                          onClick={() => updateStatus(q.id, 'paid', { paid_at: new Date().toISOString() })}
                          disabled={busyId === q.id}
                          className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          Mark paid
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              Reminders appear automatically as the due date nears (2 days out for Net 7, 7 for Net 14, 14 for Net 30, 30 for Net 60) and stay available once overdue.
            </p>
          </div>
        )}

        {view === 'earnings' && (
          <div className="flex flex-col gap-4">
            {paidQuotes.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <p className="font-medium text-gray-900 mb-1">No earnings recorded yet</p>
                <p className="text-sm text-gray-500">
                  Once you mark an invoice as paid, your earnings break down here by month, year and service.
                </p>
              </div>
            ) : (
              <>
                {/* Trend cards (real money) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    { label: 'This month', value: `$${thisMonthTotal.toFixed(0)}`, delta: monthDelta, sub: 'vs last month' },
                    { label: 'This week', value: `$${thisWeekTotal.toFixed(0)}`, delta: weekDelta, sub: 'vs last week' },
                    { label: 'Pending payment', value: `$${outstandingTotal.toFixed(0)}`, sub: `${outstanding.length} invoice${outstanding.length === 1 ? '' : 's'}` },
                    { label: 'Paid jobs', value: paidThisMonth, sub: 'this month' },
                  ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
                      <p className="text-xs text-gray-500">{c.label}</p>
                      <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{c.value}</p>
                      {c.delta !== null && c.delta !== undefined ? (
                        <p className="text-xs mt-1 font-medium" style={{ color: c.delta >= 0 ? '#16a34a' : '#ef4444' }}>
                          {c.delta >= 0 ? '↑' : '↓'} {Math.abs(c.delta).toFixed(0)}% <span className="text-gray-400 font-normal">{c.sub}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Earnings over time chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="font-semibold text-gray-900">Earnings over time</h2>
                    <div className="flex gap-1 bg-gray-100 rounded-full p-1">
                      {[['30d', 'Last 30 days'], ['12m', 'Last 12 months']].map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setChartRange(v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${chartRange === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
                          style={chartRange === v ? { backgroundColor: '#00267F' } : {}}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <EarningsChart series={chartSeries} />
                </div>

                {/* Drill-down filters — combine freely: "Service A in June 2026" */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Year</label>
                      <select
                        value={selYear}
                        onChange={e => setSelYear(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="all">All years</option>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Month</label>
                      <select
                        value={selMonth}
                        onChange={e => setSelMonth(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="all">All months</option>
                        {MONTHS_LONG.map((m, i) => (
                          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service</label>
                      <select
                        value={selService}
                        onChange={e => setSelService(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="all">All services</option>
                        {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client</label>
                      <select
                        value={selClient}
                        onChange={e => setSelClient(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                      >
                        <option value="all">All clients</option>
                        {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {hasEarningsFilter && (
                    <button
                      onClick={() => { setSelYear('all'); setSelMonth('all'); setSelService('all'); setSelClient('all') }}
                      className="text-xs font-medium text-gray-400 hover:text-gray-600 mt-3"
                    >
                      ✕ Clear filters
                    </button>
                  )}
                </div>

                {/* Headline for the current selection */}
                <div className="rounded-2xl p-6 sm:p-8 text-center" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#F9C000' }}>
                    {filterLabel}
                  </p>
                  <p className="text-4xl sm:text-5xl font-bold text-white tabular-nums" style={{ fontFamily: "'Sora', sans-serif" }}>
                    ${filteredTotal.toFixed(2)}
                  </p>
                  <p className="text-sm mt-2" style={{ color: '#93b8ff' }}>
                    {filteredEntries.length} line item{filteredEntries.length === 1 ? '' : 's'} across paid invoices
                  </p>
                </div>

                {filteredEntries.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ borderTop: '3px solid #00267F' }}>
                      <h2 className="font-semibold text-gray-900 mb-4">By month</h2>
                      <BarList rows={byMonth} />
                    </div>
                    <div className="flex flex-col gap-4">
                      {selYear === 'all' && byYear.length > 1 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ borderTop: '3px solid #F9C000' }}>
                          <h2 className="font-semibold text-gray-900 mb-4">By year</h2>
                          <BarList rows={byYear} accent="#F9C000" />
                        </div>
                      )}
                      {selService === 'all' && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ borderTop: '3px solid #16a34a' }}>
                          <h2 className="font-semibold text-gray-900 mb-4">By service{hasEarningsFilter ? ' (in selection)' : ''}</h2>
                          <BarList rows={byService} accent="#16a34a" />
                        </div>
                      )}
                      {selClient === 'all' && byClient.length > 1 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ borderTop: '3px solid #7C3AED' }}>
                          <h2 className="font-semibold text-gray-900 mb-4">Top clients{hasEarningsFilter ? ' (in selection)' : ''}</h2>
                          <BarList rows={byClient} accent="#7C3AED" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent transactions */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Recent transactions</h2>
                    <button
                      onClick={exportEarningsCsv}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors hover:border-gray-400"
                      style={{ borderColor: '#00267F', color: '#00267F' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                          <th className="font-semibold px-5 sm:px-6 py-3">Job</th>
                          <th className="font-semibold px-3 py-3">Client</th>
                          <th className="font-semibold px-3 py-3">Date paid</th>
                          <th className="font-semibold px-5 sm:px-6 py-3 text-right">Amount</th>
                          <th className="font-semibold px-3 py-3"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidTx.slice(0, 10).map(t => (
                          <tr key={t.id} className="border-t border-gray-50">
                            <td className="px-5 sm:px-6 py-3">
                              <span className="font-semibold" style={{ color: '#00267F' }}>{t.ref}</span>
                              <span className="block text-xs text-gray-400 truncate max-w-[180px]">{t.title}{t.items > 1 ? ` +${t.items - 1} more` : ''}</span>
                            </td>
                            <td className="px-3 py-3 text-gray-600 capitalize">{t.client}</td>
                            <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{fmtDate(t._q.paid_at)}</td>
                            <td className="px-5 sm:px-6 py-3 text-right font-bold tabular-nums" style={{ color: '#16a34a' }}>${t.amount.toFixed(2)}</td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => confirmDeleteInvoice(t._q)}
                                disabled={busyId === t.id}
                                title="Delete this invoice and remove it from earnings"
                                aria-label="Delete invoice"
                                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {paidTx.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">Showing 10 of {paidTx.length} paid jobs · Export CSV for the full list</p>
                  )}
                </div>
              </>
            )}
            <p className="text-xs text-gray-400 text-center">
              Based on invoices you&apos;ve marked as paid · {paidQuotes.length} paid job{paidQuotes.length === 1 ? '' : 's'} · ${totalEarned.toFixed(2)} lifetime total
            </p>
          </div>
        )}

        {view === 'quotes' && (<>
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['all', 'sent', 'accepted', 'invoiced', 'completed', 'paid', 'declined'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
              style={filter === f ? { backgroundColor: '#00267F' } : {}}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f] || f}
            </button>
          ))}
        </div>

        {/* Sort + month/year filter */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select value={quoteSort} onChange={e => setQuoteSort(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <select value={quoteMonth} onChange={e => setQuoteMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
            <option value="all">All months</option>
            {MONTH_OPTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={quoteYear} onChange={e => setQuoteYear(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white">
            <option value="all">All years</option>
            {quoteYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {(quoteMonth !== 'all' || quoteYear !== 'all') && (
            <button onClick={() => { setQuoteMonth('all'); setQuoteYear('all') }} className="text-xs text-gray-500 hover:text-gray-800 font-medium">Clear dates</button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">
              {quotes.length === 0 ? 'No quotes yet' : 'Nothing here'}
            </p>
            <p className="text-sm text-gray-500">
              {quotes.length === 0
                ? 'Create a quote from any conversation in your inbox.'
                : 'No quotes match this filter.'}
            </p>
            {quotes.length === 0 && (
              <Link
                href="/inbox"
                className="inline-block mt-5 text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#00267F' }}
              >
                Go to inbox →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map(q => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="w-full text-left px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: '#00267F' }}>{q.quote_number}</span>
                      <StatusChip status={q.status} />
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {q.client_name || 'Client'} · {fmtDate(q.quote_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(q.total).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">due {fmtDate(q.due_date)}</p>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-gray-400 flex-shrink-0 transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {expandedId === q.id && (
                  <div className="px-5 sm:px-6 pb-5 border-t border-gray-50">
                    <div className="mt-4 rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(q.items || []).map((item, i) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="px-4 py-2.5 text-gray-700">{item.description || ''}</td>
                              <td className="px-4 py-2.5 text-center text-gray-500">{item.qty}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                                {item.price ? `$${((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1)).toFixed(2)}` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {q.notes && (
                      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                        <span className="font-semibold text-gray-600">Notes:</span> {q.notes}
                      </p>
                    )}

                    {/* Invoice details once one exists */}
                    {q.invoice_number && (
                      <div className="mt-4 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                        <span className="text-xs font-semibold" style={{ color: '#92400E' }}>Invoice {q.invoice_number}</span>
                        <span className="text-xs" style={{ color: '#B45309' }}>Issued {fmtDate(q.invoiced_at)}</span>
                        <span className="text-xs" style={{ color: '#B45309' }}>Due {fmtDate(q.invoice_due_date)}</span>
                        {q.completed_at && <span className="text-xs" style={{ color: '#B45309' }}>You confirmed {fmtDate(q.completed_at)}</span>}
                        {q.client_completed_at && <span className="text-xs" style={{ color: '#B45309' }}>Client confirmed {fmtDate(q.client_completed_at)}</span>}
                        {q.paid_at && <span className="text-xs font-semibold" style={{ color: '#166534' }}>Paid {fmtDate(q.paid_at)}</span>}
                        {q.receipt_sent_at && <span className="text-xs font-semibold" style={{ color: '#166534' }}>Receipt sent {fmtDate(q.receipt_sent_at)}</span>}
                      </div>
                    )}

                    {/* Lifecycle tick boxes — confirmed via popup, untick to undo */}
                    {['invoiced', 'completed', 'paid'].includes(q.status) && (
                      <div className="mt-4 rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
                        <CheckRow
                          label="Job completed (your confirmation)"
                          sublabel={
                            q.completed_at && q.client_completed_at ? 'Both confirmed. Reviews are open ✓'
                            : q.completed_at ? 'Waiting for the client to confirm on their side'
                            : q.client_completed_at ? 'Client has confirmed. Tick to complete the job'
                            : 'Tick when the work is finished'
                          }
                          checked={!!q.completed_at}
                          disabled={busyId === q.id}
                          onToggle={() => requestCompletedToggle(q)}
                        />
                        <CheckRow
                          label="Paid"
                          sublabel={q.paid_at ? `Received ${fmtDate(q.paid_at)} · counted in your earnings` : 'Tick when the money is in hand'}
                          checked={q.status === 'paid'}
                          disabled={busyId === q.id}
                          onToggle={() => requestPaidToggle(q)}
                        />
                      </div>
                    )}

                    {/* Send-invoice form */}
                    {invoicingId === q.id && q.status === 'accepted' && (
                      <div className="mt-4 rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Payment terms</label>
                          <select
                            value={invoiceTerms}
                            onChange={e => setInvoiceTerms(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                          >
                            {INVOICE_TERMS.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 sm:self-end">
                          <button
                            onClick={() => sendInvoice(q)}
                            disabled={busyId === q.id}
                            className="text-xs font-semibold px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                          >
                            {busyId === q.id ? 'Sending…' : 'Send invoice'}
                          </button>
                          <button
                            onClick={() => setInvoicingId(null)}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                      <p className="text-xs text-gray-400">
                        Sent to {q.client_email || 'client'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => printSavedQuote(q, profile)}
                          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors"
                          style={{ borderColor: '#00267F', color: '#00267F' }}
                        >
                          Quote PDF
                        </button>
                        {q.invoice_number && (
                          <button
                            onClick={() => printSavedQuote(q, profile, { type: 'invoice' })}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                          >
                            Invoice PDF
                          </button>
                        )}

                        {q.status === 'paid' && q.paid_at && (
                          <>
                            <button
                              onClick={() => printSavedQuote(q, profile, { type: 'receipt' })}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors"
                              style={{ borderColor: '#16a34a', color: '#166534' }}
                            >
                              Receipt PDF
                            </button>
                            <button
                              onClick={() => sendReceipt(q)}
                              disabled={busyId === q.id || !q.message_id}
                              title={!q.message_id ? 'No linked conversation to send to' : 'Email & message the paid receipt to the client'}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: '#16a34a' }}
                            >
                              {busyId === q.id ? 'Sending…' : receiptSentIds.has(q.id) ? 'Receipt sent ✓' : 'Send receipt'}
                            </button>
                          </>
                        )}

                        {q.status === 'sent' && (
                          <>
                            <button
                              onClick={() => updateStatus(q.id, 'accepted')}
                              disabled={busyId === q.id}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                              style={{ borderColor: '#16a34a', color: '#16a34a' }}
                            >
                              Mark accepted
                            </button>
                            <button
                              onClick={() => updateStatus(q.id, 'declined')}
                              disabled={busyId === q.id}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:border-gray-500 transition-colors disabled:opacity-50"
                            >
                              Mark declined
                            </button>
                          </>
                        )}

                        {q.status === 'accepted' && invoicingId !== q.id && (
                          <button
                            onClick={() => setInvoicingId(q.id)}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                          >
                            Send invoice →
                          </button>
                        )}

                        {q.status === 'declined' && (
                          <button
                            onClick={() => updateStatus(q.id, 'sent')}
                            disabled={busyId === q.id}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:border-gray-500 transition-colors disabled:opacity-50"
                          >
                            Reset to sent
                          </button>
                        )}

                        <button
                          onClick={() => confirmDeleteInvoice(q)}
                          disabled={busyId === q.id}
                          title="Permanently delete this quote/invoice"
                          className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                          style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" /></svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8">
          Clients accept or decline quotes from their messages. Once accepted, send the invoice,
          tick the job complete, then tick it paid, and your earnings update automatically.
        </p>
        </>)}
      </div>

      {/* Confirmation popup for lifecycle changes */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmAction(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
              {confirmAction.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">{confirmAction.body}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null) }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: confirmAction.danger ? '#dc2626' : '#00267F' }}
              >
                {confirmAction.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg" style={{ backgroundColor: toast.err ? '#dc2626' : '#00267F' }}>
          {toast.msg}
        </div>
      )}
    </main>
  )
}
