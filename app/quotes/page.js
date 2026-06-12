'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { printSavedQuote } from '@/lib/printQuote'

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

const INVOICE_TERMS = [
  { value: 'due_receipt', label: 'Due on receipt', days: 0 },
  { value: 'net7', label: 'Net 7 days', days: 7 },
  { value: 'net14', label: 'Net 14 days', days: 14 },
  { value: 'net30', label: 'Net 30 days', days: 30 },
]

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

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function QuotesPage() {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [invoicingId, setInvoicingId] = useState(null)
  const [invoiceTerms, setInvoiceTerms] = useState('net14')
  const [busyId, setBusyId] = useState(null)
  const [view, setView] = useState('quotes')
  const [confirmAction, setConfirmAction] = useState(null)
  const [selYear, setSelYear] = useState('all')
  const [selMonth, setSelMonth] = useState('all')
  const [selService, setSelService] = useState('all')
  const [selClient, setSelClient] = useState('all')

  useEffect(() => {
    if (authLoading) return
    if (!authUser) { router.push('/login'); return }

    async function load() {
      const { data: p } = await supabase
        .from('freelancers')
        .select('id, name, company_name, trade, location, email, avatar_url')
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

  async function updateStatus(quoteId, status, extra = {}) {
    setBusyId(quoteId)
    const patch = { status, ...extra }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quoteId)
    if (!error) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, ...patch } : q))
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
      supabase.from('message_replies').insert({
        message_id: q.message_id,
        sender_name: profile.name,
        sender_user_id: authUser?.id,
        body: `Sent invoice ${invoiceNumber} — payment due ${fmtDate(dueStr)} (${terms.label.toLowerCase()})`,
      }).then(() => {})
      fetch('/api/notify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: q.message_id,
          kind: 'invoice',
          message: `Invoice ${invoiceNumber} for $${Number(q.total).toFixed(2)} — payment due ${fmtDate(dueStr)}`,
        }),
      }).catch(() => {})
    }
    setBusyId(null)
  }

  // Lifecycle tickboxes — every change is confirmed in a popup, and
  // unticking reverts an accidental click.
  function requestCompletedToggle(q) {
    if (q.status === 'completed') {
      setConfirmAction({
        title: 'Undo job completed?',
        body: `${q.quote_number} will go back to "Invoiced".`,
        confirmLabel: 'Undo',
        onConfirm: () => updateStatus(q.id, 'invoiced', { completed_at: null }),
      })
    } else if (q.status === 'invoiced') {
      setConfirmAction({
        title: 'Mark job as completed?',
        body: `Confirm the work for ${q.client_name || 'this client'} is finished.`,
        confirmLabel: 'Job completed',
        onConfirm: () => updateStatus(q.id, 'completed', { completed_at: new Date().toISOString() }),
      })
    }
  }

  function requestPaidToggle(q) {
    if (q.status === 'paid') {
      setConfirmAction({
        title: 'Undo payment?',
        body: `${q.invoice_number || q.quote_number} will be marked unpaid and $${Number(q.total).toFixed(2)} removed from your earnings.`,
        confirmLabel: 'Mark unpaid',
        onConfirm: () => updateStatus(q.id, q.completed_at ? 'completed' : 'invoiced', { paid_at: null }),
      })
    } else if (q.status === 'invoiced' || q.status === 'completed') {
      setConfirmAction({
        title: 'Confirm payment received?',
        body: `$${Number(q.total).toFixed(2)} from ${q.client_name || 'this client'} will be added to your earnings.`,
        confirmLabel: 'Payment received',
        onConfirm: () => updateStatus(q.id, 'paid', {
          paid_at: new Date().toISOString(),
          ...(q.completed_at ? {} : { completed_at: new Date().toISOString() }),
        }),
      })
    }
  }

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const sumWhere = statuses => quotes
    .filter(q => statuses.includes(q.status))
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0)
  const totalEarned = sumWhere(['paid'])
  const pendingPayment = sumWhere(['invoiced', 'completed'])
  const pendingCount = quotes.filter(q => q.status === 'sent').length

  // ── Earnings breakdowns (paid quotes only) ──
  // Earnings are broken down at the LINE-ITEM level so year, month and
  // service filters can combine: "Service A in June", "Service A all
  // year", "everything in 2026", etc.
  const paidQuotes = quotes.filter(q => q.status === 'paid' && q.paid_at)
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
        // Item descriptions look like "Service name — details"; group by the name
        service: (item.description || 'Other').split('—')[0].trim().slice(0, 60) || 'Other',
        client: q.client_name?.trim() || q.client_email || 'Client',
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

        {/* View switch: quote list vs earnings breakdown */}
        <div className="flex gap-1 mb-6 bg-white rounded-full border border-gray-200 p-1 w-fit">
          {[['quotes', 'Quotes'], ['earnings', 'Earnings breakdown']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${view === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`}
              style={view === v ? { backgroundColor: '#00267F' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

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

        {filtered.length === 0 ? (
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
              <a
                href="/inbox"
                className="inline-block mt-5 text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#00267F' }}
              >
                Go to inbox →
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(q => (
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
                              <td className="px-4 py-2.5 text-gray-700">{item.description || '—'}</td>
                              <td className="px-4 py-2.5 text-center text-gray-500">{item.qty}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                                {item.price ? `$${((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1)).toFixed(2)}` : '—'}
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
                        {q.completed_at && <span className="text-xs" style={{ color: '#B45309' }}>Job completed {fmtDate(q.completed_at)}</span>}
                        {q.paid_at && <span className="text-xs font-semibold" style={{ color: '#166534' }}>Paid {fmtDate(q.paid_at)}</span>}
                      </div>
                    )}

                    {/* Lifecycle tick boxes — confirmed via popup, untick to undo */}
                    {['invoiced', 'completed', 'paid'].includes(q.status) && (
                      <div className="mt-4 rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
                        <CheckRow
                          label="Job completed"
                          sublabel={q.completed_at ? `Completed ${fmtDate(q.completed_at)}` : 'Tick when the work is finished'}
                          checked={!!q.completed_at}
                          disabled={busyId === q.id || q.status === 'paid'}
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
          tick the job complete, then tick it paid — your earnings update automatically.
        </p>
        </>)}
      </div>

      {/* Confirmation popup for lifecycle changes */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
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
                style={{ backgroundColor: '#00267F' }}
              >
                {confirmAction.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
