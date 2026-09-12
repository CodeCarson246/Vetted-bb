'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'

const STATUS = {
  open:    { label: 'Open',    style: { backgroundColor: '#EEF2FF', color: '#00267F' } },
  awarded: { label: 'Awarded', style: { backgroundColor: '#DCFCE7', color: '#166534' } },
  closed:  { label: 'Closed',  style: { backgroundColor: '#F3F4F6', color: '#4B5563' } },
}

// Every job the organisation has sent out for quotes, with how many
// professionals were asked and how many have come back.
export default function QuoteRequests() {
  const { org, loading } = useOrganisation()
  const [rows, setRows] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading || !org) return
    let cancelled = false
    ;(async () => {
      const [{ data: reqs }, { data: msgs }, { data: quotes }] = await Promise.all([
        supabase.from('quote_requests').select('*').eq('organisation_id', org.id).order('created_at', { ascending: false }),
        supabase.from('messages').select('id, quote_request_id').eq('organisation_id', org.id).not('quote_request_id', 'is', null),
        supabase.from('quotes').select('id, quote_request_id, status').eq('organisation_id', org.id).not('quote_request_id', 'is', null),
      ])
      if (cancelled) return
      const invited = {}, quoted = {}
      for (const m of msgs || []) invited[m.quote_request_id] = (invited[m.quote_request_id] || 0) + 1
      for (const q of quotes || []) quoted[q.quote_request_id] = (quoted[q.quote_request_id] || 0) + 1
      setRows((reqs || []).map(r => ({ ...r, invited: invited[r.id] || 0, quoted: quoted[r.id] || 0 })))
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [loading, org])

  if (loading || !org) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Quote requests</h1>
            <p className="text-sm text-gray-500">Describe a job once, send it to several professionals, and compare what comes back.</p>
          </div>
          <Link href="/organisation/requests/new" className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
            New request
          </Link>
        </div>

        {!ready ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No requests yet</p>
            <p className="text-sm text-gray-500 mb-5">Shortlist a few professionals, then send them all the same brief in one go.</p>
            <Link href="/organisation/requests/new" className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90" style={{ backgroundColor: '#00267F' }}>Start a request</Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(r => {
              const st = STATUS[r.status] || STATUS.open
              return (
                <li key={r.id}>
                  <Link href={`/organisation/requests/${r.id}`} className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-colors" style={{ borderLeft: '4px solid #00267F', textDecoration: 'none' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={st.style}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-3">
                      <strong className="text-gray-900">{r.quoted}</strong> of <strong className="text-gray-900">{r.invited}</strong> professional{r.invited === 1 ? '' : 's'} {r.quoted === 1 ? 'has' : 'have'} quoted
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
