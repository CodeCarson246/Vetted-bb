'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { formatParish } from '@/lib/formatParish'
import { isVerified } from '@/components/VerifiedBadge'
import TrustMark from '@/components/TrustMark'

// The notify-message route allows 5 sends per 10 minutes per address, and
// procurement rarely wants more than three quotes anyway.
const MAX_INVITES = 5

const fieldCls = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

// Send one brief to several shortlisted professionals. Each becomes an
// ordinary enquiry thread in their inbox, stamped with the request so the
// quotes that come back can be compared side by side.
export default function NewQuoteRequest() {
  const router = useRouter()
  const { user, org, loading } = useOrganisation()
  const [saved, setSaved] = useState([])
  const [ready, setReady] = useState(false)
  const [chosen, setChosen] = useState(() => new Set())
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false
    supabase
      .from('saved_professionals')
      .select('id, freelancer_id, freelancers(id, name, trade, location, avatar_url, verified, phone_verified, govt_vendor_status, available)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setSaved((data || []).filter(r => r.freelancers))
        setReady(true)
      })
    return () => { cancelled = true }
  }, [loading, user])

  function toggle(id) {
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_INVITES) next.add(id)
      return next
    })
  }

  async function send(e) {
    e.preventDefault()
    if (chosen.size === 0) { setError('Choose at least one professional.'); return }
    if (title.trim().length < 3) { setError('Give the job a short title.'); return }
    if (details.trim().length < 20) { setError('Add a few lines of detail so professionals can quote accurately.'); return }
    setBusy(true); setError('')

    const { data: req, error: reqErr } = await supabase
      .from('quote_requests')
      .insert({ organisation_id: org.id, created_by: user.id, title: title.trim(), details: details.trim() })
      .select('id')
      .single()
    if (reqErr || !req) { setError('Could not create the request. Please try again.'); setBusy(false); return }

    const senderName = user.user_metadata?.full_name || user.email.split('@')[0]
    const subject = `Quote request: ${title.trim()}`
    const message = `${details.trim()}\n\nSent on behalf of ${org.name}${org.division ? `, ${org.division}` : ''}. Please reply with a quote when you can.`

    const ids = [...chosen]
    const results = await Promise.all(ids.map(fid =>
      supabase.from('messages').insert({
        freelancer_id: fid,
        sender_name: senderName,
        sender_email: user.email,
        sender_user_id: user.id,
        organisation_id: org.id,
        quote_request_id: req.id,
        subject,
        message,
        created_at: new Date().toISOString(),
        read: false,
      })
    ))
    const failed = results.filter(r => r.error).length

    // Email + push to each professional (fire-and-forget)
    for (const fid of ids) {
      fetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freelancer_id: fid, senderName: `${senderName} (${org.name})`, senderEmail: user.email, subject, message }),
      }).catch(() => {})
    }

    if (failed > 0 && failed === ids.length) {
      setError('The request was created but the enquiries could not be sent. Please try again from the request page.')
      setBusy(false)
      return
    }
    router.replace(`/organisation/requests/${req.id}`)
  }

  if (loading || !org) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <Link href="/organisation/requests" className="text-sm font-medium text-gray-500 hover:text-gray-700">← Quote requests</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1">Request quotes</h1>
        <p className="text-sm text-gray-500 mb-6">Pick up to {MAX_INVITES} professionals from your shortlist and send them the same brief.</p>

        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-gray-900">Who to ask <span className="text-gray-400 font-normal">({chosen.size} of {MAX_INVITES})</span></h2>
              <Link href="/search" className="text-sm font-semibold" style={{ color: '#00267F' }}>Add to shortlist</Link>
            </div>
            {!ready ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : saved.length === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center" style={{ backgroundColor: 'var(--row-stripe)', border: '1px dashed var(--border-card)' }}>
                <p className="text-sm text-gray-500 mb-2">Your shortlist is empty. Tap the heart on any professional to add them.</p>
                <Link href="/search" className="text-sm font-semibold" style={{ color: '#00267F' }}>Search the pool →</Link>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100">
                {saved.map(row => {
                  const f = row.freelancers
                  const on = chosen.has(f.id)
                  const full = !on && chosen.size >= MAX_INVITES
                  return (
                    <li key={row.id}>
                      <button type="button" onClick={() => toggle(f.id)} disabled={full} className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-40">
                        <span className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={on ? { backgroundColor: '#00267F', borderColor: '#00267F' } : { borderColor: '#D1D5DB' }}>
                          {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: f.avatar_url ? undefined : '#00267F' }}>
                          {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : (f.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate capitalize">
                            {f.name}
                            {isVerified(f) && <span className="ml-1.5"><TrustMark kind="verified" size={14} /></span>}
                            {f.govt_vendor_status === 'registered' && <span className="ml-1.5"><TrustMark kind="vendor" size={12} /></span>}
                          </span>
                          <span className="block text-xs text-gray-500 capitalize">{f.trade}{f.location ? ` · ${formatParish(f.location)}` : ''}</span>
                        </span>
                        <span className={`text-xs font-medium flex-shrink-0 ${f.available ? 'text-green-600' : 'text-gray-400'}`}>{f.available ? 'Available' : 'Unavailable'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-900">The job</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</label>
              <input className={fieldCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Stage and sound for a community event, 14 November" maxLength={120} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Details</label>
              <textarea className={fieldCls + ' resize-y'} rows={6} value={details} onChange={e => setDetails(e.target.value)} maxLength={2000}
                placeholder="What needs doing, where, when, and anything that affects the price. The clearer this is, the more comparable the quotes." />
              <p className="text-xs text-gray-400 mt-1 text-right">{details.length}/2000</p>
            </div>
            <p className="text-xs text-gray-400">Each professional receives this as an enquiry from {org.name}. Their quotes come back to one place so you can compare them.</p>
          </div>

          {error && <p className="text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }} role="alert">{error}</p>}

          <button type="submit" disabled={busy || !ready} className="w-full sm:w-auto sm:self-start text-sm font-semibold px-7 py-3 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
            {busy ? 'Sending…' : `Send to ${chosen.size || ''} professional${chosen.size === 1 ? '' : 's'}`}
          </button>
        </form>
      </div>
    </main>
  )
}
