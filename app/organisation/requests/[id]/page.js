'use client'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { formatParish } from '@/lib/formatParish'
import { termLabel } from '@/lib/paymentTerms'
import { printSavedQuote } from '@/lib/printQuote'
import { currencySymbol } from '@/lib/organisations'
import { isVerified } from '@/components/VerifiedBadge'
import TrustMark from '@/components/TrustMark'
import { profileUrl } from '@/lib/handles'

const STATUS_LABELS = {
  sent: 'Awaiting decision', accepted: 'Accepted', declined: 'Declined',
  invoiced: 'Invoiced', completed: 'Completed', paid: 'Paid',
}
const STATUS_STYLES = {
  sent:      { backgroundColor: '#FEF3C7', color: '#92400E' },
  accepted:  { backgroundColor: '#DCFCE7', color: '#166534' },
  declined:  { backgroundColor: '#FEE2E2', color: '#991B1B' },
  invoiced:  { backgroundColor: '#EEF2FF', color: '#00267F' },
  completed: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  paid:      { backgroundColor: '#DCFCE7', color: '#166534' },
}

// One request, every professional it went to, and their quotes side by
// side. Accepting a quote here is the same action as accepting it in the
// thread: the quote's status changes and the professional is notified.
export default function QuoteRequestDetail() {
  const { id } = useParams()
  const { org, loading } = useOrganisation()
  const [req, setReq] = useState(null)
  const [rows, setRows] = useState([])
  const [ready, setReady] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!org || !id) return
    const [{ data: r }, { data: msgs }, { data: quotes }] = await Promise.all([
      supabase.from('quote_requests').select('*').eq('id', id).eq('organisation_id', org.id).maybeSingle(),
      supabase.from('messages').select('id, freelancer_id, created_at, freelancers(id, name, company_name, trade, location, email, avatar_url, verified, phone_verified, govt_vendor_status)').eq('quote_request_id', id).order('created_at', { ascending: true }),
      supabase.from('quotes').select('*').eq('quote_request_id', id).order('created_at', { ascending: false }),
    ])
    setReq(r || null)
    const latestByFreelancer = {}
    for (const q of quotes || []) if (!latestByFreelancer[q.freelancer_id]) latestByFreelancer[q.freelancer_id] = q
    setRows((msgs || []).filter(m => m.freelancers).map(m => ({ message: m, freelancer: m.freelancers, quote: latestByFreelancer[m.freelancer_id] || null })))
    setReady(true)
  }, [org, id])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; state is set after the awaits, not synchronously
  useEffect(() => { if (!loading && org) load() }, [loading, org, load])

  async function respond(quote, status) {
    if (busyId) return
    if (status === 'declined' && !confirm('Decline this quote? The professional will be told.')) return
    if (status === 'accepted' && !confirm('Accept this quote? The professional will be told, and the request is marked as awarded.')) return
    setBusyId(quote.id); setError('')
    const { error: upErr } = await supabase.from('quotes').update({ status }).eq('id', quote.id)
    if (upErr) { setError('Could not update the quote. Please try again.'); setBusyId(null); return }
    if (status === 'accepted') {
      await supabase.from('quote_requests').update({ status: 'awarded', updated_at: new Date().toISOString() }).eq('id', id)
    }
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/notify-quote-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ quote_id: quote.id, event: status }),
    }).catch(() => {})
    await load()
    setBusyId(null)
  }

  async function closeRequest() {
    if (!confirm('Close this request? You can still see the quotes, but it will no longer show as open.')) return
    await supabase.from('quote_requests').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  if (loading || !org || !ready) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }
  if (!req) {
    return (
      <main className="min-h-screen page-bg flex items-center justify-center px-4">
        <div className="text-center"><p className="font-medium text-gray-900 mb-2">Request not found</p><Link href="/organisation/requests" className="text-sm font-semibold" style={{ color: '#00267F' }}>Back to requests</Link></div>
      </main>
    )
  }

  const quoted = rows.filter(r => r.quote)
  const lowest = quoted.length ? Math.min(...quoted.map(r => Number(r.quote.total) || 0)) : null

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <Link href="/organisation/requests" className="text-sm font-medium text-gray-500 hover:text-gray-700">← Quote requests</Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{req.title}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={req.status === 'awarded' ? { backgroundColor: '#DCFCE7', color: '#166534' } : req.status === 'closed' ? { backgroundColor: '#F3F4F6', color: '#4B5563' } : { backgroundColor: '#EEF2FF', color: '#00267F' }}>
                {req.status === 'awarded' ? 'Awarded' : req.status === 'closed' ? 'Closed' : 'Open'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Sent {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {quoted.length} of {rows.length} quoted</p>
          </div>
          {req.status === 'open' && (
            <button onClick={closeRequest} className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 flex-shrink-0">Close request</button>
          )}
        </div>

        {req.details && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Brief</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{req.details}</p>
          </div>
        )}

        {error && <p className="text-sm rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}

        {/* Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {rows.map(({ message, freelancer: f, quote: q }) => {
            const isLowest = q && lowest !== null && (Number(q.total) || 0) === lowest && quoted.length > 1
            const sym = currencySymbol(q?.currency)
            return (
              <div key={message.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col" style={{ borderTop: `4px solid ${q ? (q.status === 'accepted' || q.status === 'paid' ? '#16a34a' : '#00267F') : '#D1D5DB'}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <Link href={profileUrl(f)} className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: f.avatar_url ? undefined : '#00267F' }}>
                    {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : (f.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </Link>
                  <div className="min-w-0">
                    <Link href={profileUrl(f)} className="block text-sm font-semibold text-gray-900 truncate capitalize" style={{ textDecoration: 'none' }}>
                      {f.name}
                      {isVerified(f) && <span className="ml-1.5"><TrustMark kind="verified" size={14} /></span>}
                    </Link>
                    <p className="text-xs text-gray-500 capitalize truncate flex items-center gap-1.5">{f.trade}{f.location ? ` · ${formatParish(f.location)}` : ''}{f.govt_vendor_status === 'registered' && <TrustMark kind="vendor" size={11} />}</p>
                  </div>
                </div>

                {!q ? (
                  <div className="flex-1 rounded-xl px-4 py-6 text-center" style={{ backgroundColor: 'var(--row-stripe)', border: '1px dashed var(--border-card)' }}>
                    <p className="text-sm text-gray-500">No quote yet</p>
                    <Link href="/messages" className="text-xs font-semibold mt-1 inline-block" style={{ color: '#00267F' }}>Open the conversation</Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="text-2xl font-bold tabular-nums" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{sym}{Number(q.total || 0).toFixed(2)}</p>
                      {isLowest && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>Lowest</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{q.quote_number} · {termLabel(q.payment_terms)}</p>
                    <ul className="text-xs text-gray-600 flex flex-col gap-1 mb-4 flex-1">
                      {(q.items || []).slice(0, 4).map((it, i) => (
                        <li key={i} className="flex justify-between gap-2"><span className="truncate">{it.description}</span><span className="tabular-nums flex-shrink-0">{it.price ? sym + ((parseFloat(it.price) || 0) * (parseInt(it.qty) || 1)).toFixed(2) : ''}</span></li>
                      ))}
                      {(q.items || []).length > 4 && <li className="text-gray-400">+{q.items.length - 4} more</li>}
                    </ul>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={STATUS_STYLES[q.status] || STATUS_STYLES.sent}>{STATUS_LABELS[q.status] || q.status}</span>
                      <button onClick={() => printSavedQuote(q, f)} className="text-xs font-semibold" style={{ color: '#00267F' }}>View PDF</button>
                    </div>
                    {q.status === 'sent' && req.status !== 'closed' && (
                      <div className="flex gap-2">
                        <button onClick={() => respond(q, 'accepted')} disabled={busyId === q.id} className="flex-1 text-sm font-semibold py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>Accept</button>
                        <button onClick={() => respond(q, 'declined')} disabled={busyId === q.id} className="flex-1 text-sm font-semibold py-2 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50">Decline</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 mt-6">Accepting a quote here is the same as accepting it in the conversation. The professional invoices {org.name} directly.</p>
      </div>
    </main>
  )
}
