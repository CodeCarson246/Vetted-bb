'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { ORG_KINDS, consumePendingInvite } from '@/lib/organisations'
import { termLabel } from '@/lib/paymentTerms'

const STATUS_LABELS = {
  sent: 'Awaiting your decision', accepted: 'Accepted', declined: 'Declined',
  invoiced: 'Invoiced', completed: 'Job completed', paid: 'Paid',
}
const STATUS_STYLES = {
  sent:      { backgroundColor: '#FEF3C7', color: '#92400E' },
  accepted:  { backgroundColor: '#DCFCE7', color: '#166534' },
  declined:  { backgroundColor: '#FEE2E2', color: '#991B1B' },
  invoiced:  { backgroundColor: '#EEF2FF', color: '#00267F' },
  completed: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  paid:      { backgroundColor: '#DCFCE7', color: '#166534' },
}

function Card({ title, desc, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function OrganisationDashboard() {
  const { org, isOwner, loading, refresh } = useOrganisation()
  const [stats, setStats] = useState({ enquiries: 0, toReview: 0, active: 0, completed: 0 })
  const [recent, setRecent] = useState([])
  const [ready, setReady] = useState(false)

  // A pending invite from an earlier visit is redeemed here too, so the
  // login path (which does not know about invites) still completes it.
  useEffect(() => {
    consumePendingInvite().then(joined => { if (joined) refresh() })
  }, [refresh])

  useEffect(() => {
    if (loading || !org) return
    let cancelled = false
    ;(async () => {
      const [{ count: enquiries }, { data: quotes }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('organisation_id', org.id),
        supabase.from('quotes').select('id, quote_number, client_name, total, status, created_at, freelancers(name, trade)').eq('organisation_id', org.id).order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      const qs = quotes || []
      setStats({
        enquiries: enquiries || 0,
        toReview: qs.filter(q => q.status === 'sent').length,
        active: qs.filter(q => ['accepted', 'invoiced'].includes(q.status)).length,
        completed: qs.filter(q => ['completed', 'paid'].includes(q.status)).length,
      })
      setRecent(qs.slice(0, 6))
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [loading, org])

  if (loading || !org) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const kindLabel = ORG_KINDS.find(k => k.value === org.kind)?.label || 'Organisation'
  const missingDetails = !org.address_line1 && !org.city_town

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
              {org.verified ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  Verified organisation
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not yet verified</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {org.division ? `${org.division} · ` : ''}{kindLabel} · Payment terms: {termLabel(org.default_payment_terms)}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/organisation/requests/new" className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F', textDecoration: 'none' }}>
              Request quotes
            </Link>
            <Link href="/search" className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F', textDecoration: 'none' }}>
              Find professionals
            </Link>
          </div>
        </div>

        {/* Nudges */}
        {!org.verified && (
          <div className="rounded-2xl px-5 py-4 mb-4 text-sm" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
            <strong>Verification pending.</strong> Vetted.bb checks organisations manually so professionals know an enquiry from you is genuine. You can search and enquire in the meantime; the verified mark appears once the check is done.
          </div>
        )}
        {missingDetails && isOwner && (
          <div className="rounded-2xl px-5 py-4 mb-4 text-sm flex flex-col sm:flex-row sm:items-center gap-3" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            <span className="flex-1"><strong>Add your billing address.</strong> Professionals print it on their quotes and invoices to you, so it needs to be right.</span>
            <Link href="/organisation/settings" className="text-sm font-semibold underline flex-shrink-0">Open settings</Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Enquiries sent', value: stats.enquiries, href: '/messages' },
            { label: 'Quotes to review', value: stats.toReview, href: '/jobs', accent: stats.toReview > 0 },
            { label: 'Active jobs', value: stats.active, href: '/jobs' },
            { label: 'Completed', value: stats.completed, href: '/jobs' },
          ].map(s => (
            <Link key={s.label} href={s.href} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-colors" style={{ borderTop: `3px solid ${s.accent ? '#F9C000' : '#00267F'}` }}>
              <p className="text-3xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "'Sora', sans-serif" }}>{ready ? s.value : '…'}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent quotes */}
          <div className="lg:col-span-2">
            <Card title="Recent quotes" desc="Every quote sent to your organisation, whoever on the team asked for it." action={<span className="flex items-center gap-3"><Link href="/organisation/records" className="text-sm font-semibold" style={{ color: '#00267F' }}>Records</Link><Link href="/jobs" className="text-sm font-semibold" style={{ color: '#00267F' }}>View all</Link></span>}>
              {!ready ? (
                <p className="text-sm text-gray-400 py-4">Loading…</p>
              ) : recent.length === 0 ? (
                <div className="rounded-xl px-4 py-8 text-center" style={{ backgroundColor: 'var(--row-stripe)', border: '1px dashed var(--border-card)' }}>
                  <p className="text-sm text-gray-500 mb-3">No quotes yet. Find a professional, send an enquiry, and their quote lands here.</p>
                  <Link href="/search" className="text-sm font-semibold" style={{ color: '#00267F' }}>Search the pool →</Link>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-gray-100">
                  {recent.map(q => (
                    <li key={q.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{q.freelancers?.name || 'Professional'}{q.freelancers?.trade ? <span className="font-normal text-gray-400"> · {q.freelancers.trade}</span> : null}</p>
                        <p className="text-xs text-gray-400">{q.quote_number}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#00267F' }}>Bds${Number(q.total || 0).toFixed(2)}</span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={STATUS_STYLES[q.status] || STATUS_STYLES.sent}>{STATUS_LABELS[q.status] || q.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* How it works */}
          <Card title="How it works">
            <ol className="flex flex-col gap-3">
              {[
                ['Search', 'Filter the pool by trade, parish and verification. Shortlist the ones you like.'],
                ['Enquire', 'Send an enquiry from a profile. It goes out as your organisation, and the whole team can see the thread.'],
                ['Decide', 'The professional replies with a quote. Accept it here; they invoice your organisation directly.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center text-xs font-bold text-white rounded-full" style={{ width: 22, height: 22, backgroundColor: '#00267F' }}>{i + 1}</span>
                  <span className="text-sm text-gray-600 leading-snug"><strong className="text-gray-900">{t}.</strong> {d}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-400 mt-4">Vetted.bb never handles payment. Professionals invoice you, and you pay them directly.</p>
          </Card>
        </div>
      </div>
    </main>
  )
}
