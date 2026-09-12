'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { ORG_KINDS, consumePendingInvite } from '@/lib/organisations'
import { termLabel } from '@/lib/paymentTerms'
import TrustMark from '@/components/TrustMark'

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
  const { user, org, isOwner, loading, refresh } = useOrganisation()
  const [stats, setStats] = useState({ enquiries: 0, toReview: 0, active: 0, completed: 0 })
  const [recent, setRecent] = useState([])
  const [ready, setReady] = useState(false)
  // First-run checklist: counts the dashboard doesn't otherwise need.
  const [setup, setSetup] = useState({ members: 0, saved: 0 })
  const [setupDismissed, setSetupDismissed] = useState(false)

  // A pending invite from an earlier visit is redeemed here too, so the
  // login path (which does not know about invites) still completes it.
  useEffect(() => {
    consumePendingInvite().then(joined => { if (joined) refresh() })
  }, [refresh])

  useEffect(() => {
    if (loading || !org) return
    let cancelled = false
    ;(async () => {
      const [{ count: enquiries }, { data: quotes }, { count: members }, { count: saved }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('organisation_id', org.id),
        supabase.from('quotes').select('id, quote_number, client_name, total, status, created_at, freelancers(name, trade)').eq('organisation_id', org.id).order('created_at', { ascending: false }),
        supabase.from('organisation_members').select('*', { count: 'exact', head: true }).eq('organisation_id', org.id),
        user ? supabase.from('saved_professionals').select('*', { count: 'exact', head: true }).eq('user_id', user.id) : Promise.resolve({ count: 0 }),
      ])
      if (cancelled) return
      setSetup({ members: members || 0, saved: saved || 0 })
      try { setSetupDismissed(localStorage.getItem(`vetted_org_setup_done_${org.id}`) === '1') } catch { /* ignore */ }
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
  }, [loading, org, user])

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
                <TrustMark kind="organisation" size={18} withLabel />
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not yet verified</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {org.division ? `${org.division} · ` : ''}{kindLabel} · Payment terms: {termLabel(org.default_payment_terms)}
              {' · '}<Link href={`/organisations/${org.id}`} className="font-semibold" style={{ color: '#00267F' }}>Public page</Link>
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
        {/* First-run checklist: shown until every step is done, or dismissed
            once it is. Absorbs the old "add your billing address" nudge. */}
        {ready && !setupDismissed && (() => {
          const steps = [
            { done: !missingDetails, label: 'Add your billing address', sub: 'Professionals print it on every quote and invoice to you.', href: '/organisation/settings', cta: 'Open settings' },
            { done: setup.members >= 2, label: 'Invite a colleague', sub: 'So quotes are never stuck in one person’s inbox.', href: '/organisation/team', cta: 'Team' },
            { done: setup.saved >= 1, label: 'Shortlist a professional', sub: 'Tap the heart on anyone you might hire.', href: '/search', cta: 'Search' },
            { done: stats.enquiries >= 1, label: 'Send your first enquiry', sub: 'Or ask several at once with a quote request.', href: '/organisation/requests/new', cta: 'Request quotes' },
          ]
          const doneCount = steps.filter(s => s.done).length
          const allDone = doneCount === steps.length
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 mb-6" style={{ borderTop: '3px solid #F9C000' }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{allDone ? 'You’re set up' : 'Get set up'} <span className="text-gray-400 font-normal">({doneCount} of {steps.length})</span></h2>
                  <p className="text-sm text-gray-500 mt-0.5">{allDone ? 'Everything is in place. This card won’t show again.' : 'Four steps, and the workspace works the way it should.'}</p>
                </div>
                {allDone && (
                  <button onClick={() => { try { localStorage.setItem(`vetted_org_setup_done_${org.id}`, '1') } catch { /* ignore */ } setSetupDismissed(true) }} className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0">Dismiss</button>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
                <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%`, backgroundColor: '#00267F' }} />
              </div>
              <ol className="flex flex-col divide-y divide-gray-100">
                {steps.map(s => (
                  <li key={s.label} className="py-2.5 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.done ? '#16a34a' : '#E5E7EB' }} aria-hidden="true">
                      {s.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm ${s.done ? 'text-gray-400 line-through' : 'font-medium text-gray-900'}`}>{s.label}</span>
                      {!s.done && <span className="block text-xs text-gray-400">{s.sub}</span>}
                    </span>
                    {!s.done && <Link href={s.href} className="text-xs font-semibold flex-shrink-0" style={{ color: '#00267F' }}>{s.cta} →</Link>}
                  </li>
                ))}
              </ol>
            </div>
          )
        })()}

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
