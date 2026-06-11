'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { printSavedQuote } from '@/lib/printQuote'

const STATUS_STYLES = {
  sent:     { backgroundColor: '#EEF2FF', color: '#00267F' },
  accepted: { backgroundColor: '#DCFCE7', color: '#166534' },
  declined: { backgroundColor: '#FEE2E2', color: '#991B1B' },
}

function StatusChip({ status }) {
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize inline-block"
      style={STATUS_STYLES[status] || STATUS_STYLES.sent}
    >
      {status}
    </span>
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

  async function updateStatus(quoteId, status) {
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId)
    if (!error) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status } : q))
    }
  }

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const acceptedValue = quotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0)
  const pendingCount = quotes.filter(q => q.status === 'sent').length

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
          <h1 className="text-2xl font-bold text-gray-900">My quotes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every quote you&apos;ve sent through Vetted.bb, in one place.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Quotes sent', value: quotes.length },
            { label: 'Awaiting reply', value: pendingCount },
            { label: 'Accepted value', value: `$${acceptedValue.toFixed(0)}` },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 text-center"
              style={{ borderTop: '3px solid #00267F' }}
            >
              <p className="text-xl sm:text-3xl font-bold mb-1" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['all', 'sent', 'accepted', 'declined'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${filter === f ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
              style={filter === f ? { backgroundColor: '#00267F' } : {}}
            >
              {f === 'sent' ? 'Awaiting reply' : f}
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

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                      <p className="text-xs text-gray-400">
                        Sent to {q.client_email || 'client'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => printSavedQuote(q, profile)}
                          className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                        >
                          Download PDF
                        </button>
                        {q.status !== 'accepted' && (
                          <button
                            onClick={() => updateStatus(q.id, 'accepted')}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors"
                            style={{ borderColor: '#16a34a', color: '#16a34a' }}
                          >
                            Mark accepted
                          </button>
                        )}
                        {q.status !== 'declined' && (
                          <button
                            onClick={() => updateStatus(q.id, 'declined')}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:border-gray-500 transition-colors"
                          >
                            Mark declined
                          </button>
                        )}
                        {q.status !== 'sent' && (
                          <button
                            onClick={() => updateStatus(q.id, 'sent')}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:border-gray-500 transition-colors"
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
          Clients can accept or decline quotes from their messages — the status updates here automatically.
        </p>
      </div>
    </main>
  )
}
