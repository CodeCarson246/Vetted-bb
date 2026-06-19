'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useRealtimeThreads } from '@/lib/useRealtimeThreads'
import { printSavedQuote } from '@/lib/printQuote'

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function JobsPage() {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  // Quotes addressed to this client (RLS matches client_email to the
  // logged-in email). Only those that became real jobs.
  const load = useCallback(async () => {
    if (!authUser) return
    const { data } = await supabase
      .from('quotes')
      .select('*, freelancers(id, name, company_name, trade, location, email, avatar_url)')
      .eq('client_email', authUser.email)
      .in('status', ['accepted', 'invoiced', 'completed', 'paid'])
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }, [authUser])

  useEffect(() => {
    if (authLoading) return
    if (!authUser) { router.push('/login'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; setJobs runs after the await, not synchronously
    load()
  }, [authUser, authLoading, router, load])

  // Live-refresh when a quote changes (e.g. the pro marks the job paid /
  // complete) + on tab focus, so the page never shows stale state.
  useRealtimeThreads(!!authUser, load)

  async function setClientCompleted(job, done) {
    setBusyId(job.id)
    const client_completed_at = done ? new Date().toISOString() : null
    // Status reflects mutual completion; never override a paid job.
    let status = job.status
    if (job.status !== 'paid') {
      status = (client_completed_at && job.completed_at) ? 'completed' : 'invoiced'
    }
    const { error } = await supabase
      .from('quotes')
      .update({ client_completed_at, status })
      .eq('id', job.id)
    if (!error) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, client_completed_at, status } : j))
      // Notify the freelancer when the client confirms completion (not on undo)
      if (client_completed_at) {
        supabase.auth.getSession().then(({ data }) => {
          const token = data.session?.access_token
          if (token) fetch('/api/notify-quote-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ quote_id: job.id, event: 'completed' }),
          }).catch(() => {})
        })
      }
    }
    setBusyId(null)
  }

  function requestToggle(job) {
    if (job.client_completed_at) {
      setConfirmAction({
        title: 'Undo your confirmation?',
        body: 'This removes your confirmation that the job is finished.',
        confirmLabel: 'Undo',
        onConfirm: () => setClientCompleted(job, false),
      })
    } else {
      setConfirmAction({
        title: 'Mark this job as completed?',
        body: job.completed_at
          ? `${job.freelancers?.name || 'The professional'} has already confirmed — this completes the job, and you’ll both be able to leave a review.`
          : `Confirm the work from ${job.freelancers?.name || 'this professional'} is finished. They also confirm on their side before reviews open.`,
        confirmLabel: 'Job completed',
        onConfirm: () => setClientCompleted(job, true),
      })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My jobs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Jobs you&apos;ve hired for. Mark a job complete once the work is done — when you and the professional both confirm, you can review each other.
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No active jobs yet</p>
            <p className="text-sm text-gray-500 mb-6">When you accept a quote from a professional, it shows up here.</p>
            <a href="/search" className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
              Find a professional →
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map(job => {
              const f = job.freelancers
              const mutual = job.completed_at && job.client_completed_at
              const initials = (f?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)
              return (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-100 p-5" style={{ borderLeft: `4px solid ${mutual ? '#16a34a' : '#00267F'}` }}>
                  <div className="flex items-start gap-4">
                    <a href={`/freelancers/${f?.id}`} className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F', textDecoration: 'none' }}>
                      {f?.avatar_url
                        ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                        : initials}
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <a href={`/freelancers/${f?.id}`} className="font-semibold capitalize hover:underline" style={{ color: '#00267F', textDecoration: 'none' }}>
                          {f?.company_name?.trim().length > 3 ? f.company_name : f?.name}
                        </a>
                        <span className="text-sm font-bold" style={{ color: '#00267F' }}>${Number(job.total).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {job.invoice_number || job.quote_number} · {f?.trade}
                        {job.invoice_due_date ? ` · due ${fmtDate(job.invoice_due_date)}` : ''}
                      </p>

                      {/* Completion status */}
                      <div className="mt-3 rounded-xl border border-gray-100 p-3">
                        <button
                          type="button"
                          onClick={() => requestToggle(job)}
                          disabled={busyId === job.id}
                          className="flex items-center gap-3 text-left w-full group disabled:opacity-40"
                        >
                          <span
                            className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                            style={job.client_completed_at
                              ? { backgroundColor: '#16a34a', borderColor: '#16a34a' }
                              : { borderColor: '#d1d5db', backgroundColor: 'var(--surface-card)' }}
                          >
                            {job.client_completed_at && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="text-sm font-medium block text-gray-900">Mark job as completed</span>
                            <span className="text-xs text-gray-400">
                              {mutual && job.status === 'paid' ? 'Completed & paid — you can leave a review ✓'
                                : mutual ? 'Both confirmed — you can review once the pro marks it paid'
                                : job.client_completed_at ? `Waiting for ${f?.name || 'the professional'} to confirm`
                                : job.completed_at ? `${f?.name || 'The professional'} has confirmed — tick to complete`
                                : 'Tick once the work is finished'}
                            </span>
                          </span>
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {job.quote_number && (
                          <button onClick={() => printSavedQuote(job, f)} className="text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors" style={{ borderColor: '#00267F', color: '#00267F' }}>
                            Quote PDF
                          </button>
                        )}
                        {job.invoice_number && (
                          <button onClick={() => printSavedQuote(job, f, { type: 'invoice' })} className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                            Invoice PDF
                          </button>
                        )}
                        {mutual && job.status === 'paid' && (
                          <a href={`/freelancers/${f?.id}#leave-review`} className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#16a34a' }}>
                            Leave a review →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>{confirmAction.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">{confirmAction.body}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">Cancel</button>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null) }} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>{confirmAction.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
