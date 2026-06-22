'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

function Stars({ n, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= Math.round(n) ? '#F9C000' : 'var(--border-card)' }}>★</span>
      ))}
    </span>
  )
}

export default function ReviewsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // all | unresponded | top
  const [replyId, setReplyId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async (freelancerId) => {
    const { data } = await supabase
      .from('reviews')
      .select('id, author, rating, comment, service_name, date, response, response_at, image_url')
      .eq('freelancer_id', freelancerId).eq('type', 'client')
      .order('date', { ascending: false })
    setReviews(data || [])
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    let cancelled = false
    supabase.from('freelancers').select('id, name').eq('user_id', user.id).maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data) { router.replace('/'); return }
        setProfile(data)
        await load(data.id)
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user, authLoading, router, load])

  async function saveReply(reviewId) {
    setSavingId(reviewId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/review-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ review_id: reviewId, response: replyText }),
    })
    setSavingId(null)
    if (!res.ok) { setToast({ msg: 'Could not save reply.', err: true }); setTimeout(() => setToast(null), 3000); return }
    const txt = replyText.trim()
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, response: txt || null, response_at: txt ? new Date().toISOString() : null } : r))
    setReplyId(null); setReplyText('')
    setToast({ msg: txt ? 'Reply posted.' : 'Reply removed.' })
    setTimeout(() => setToast(null), 3000)
  }

  if (authLoading || loading) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  const total = reviews.length
  const avg = total ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0
  const fiveStar = reviews.filter(r => r.rating === 5).length
  const responded = reviews.filter(r => r.response).length
  const responseRate = total ? Math.round((responded / total) * 100) : 0
  const breakdown = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => Math.round(r.rating) === star).length }))

  const shown = tab === 'unresponded' ? reviews.filter(r => !r.response)
    : tab === 'top' ? reviews.filter(r => r.rating >= 5)
    : reviews
  const unrespondedCount = reviews.filter(r => !r.response).length

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor customer feedback and manage your reputation.</p>
          </div>
          {profile && <a href={`/freelancers/${profile.id}`} className="text-sm font-semibold px-4 py-2.5 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>View public profile</a>}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Average rating', value: total ? avg.toFixed(1) : '—', sub: total ? <Stars n={avg} /> : 'No reviews yet' },
            { label: 'Total reviews', value: total, sub: `${fiveStar} five-star` },
            { label: '5-star reviews', value: fiveStar, sub: total ? `${Math.round((fiveStar / total) * 100)}% of total` : '—' },
            { label: 'Response rate', value: `${responseRate}%`, sub: `${responded} of ${total} replied` },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{c.value}</p>
              <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {total === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No reviews yet</p>
            <p className="text-sm text-gray-500">When clients review you after a completed, paid job, their feedback appears here for you to respond to.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Reviews list */}
            <div className="lg:col-span-2">
              <div className="flex gap-1 mb-4 bg-white rounded-full border border-gray-200 p-1 w-fit">
                {[['all', 'All reviews'], ['unresponded', `Needs reply${unrespondedCount ? ` (${unrespondedCount})` : ''}`], ['top', 'Top rated']].map(([v, label]) => (
                  <button key={v} onClick={() => setTab(v)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${tab === v ? 'text-white' : 'text-gray-500 hover:text-gray-800'}`} style={tab === v ? { backgroundColor: '#00267F' } : {}}>{label}</button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {shown.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-sm text-gray-400">Nothing here.</div>
                ) : shown.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                          {(r.author || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{r.author || 'Client'}</p>
                          {r.service_name && <p className="text-xs text-gray-400">{r.service_name}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <Stars n={r.rating} />
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mt-3">{r.comment}</p>
                    {r.image_url && <a href={r.image_url} target="_blank" rel="noopener noreferrer"><img src={r.image_url} alt="Review photo" className="mt-2 rounded-lg" style={{ maxHeight: 140, borderRadius: 10 }} /></a>}

                    {r.response && replyId !== r.id && (
                      <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: 'var(--selected-fill)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>Your reply</p>
                        <p className="text-sm text-gray-700">{r.response}</p>
                      </div>
                    )}

                    {replyId === r.id ? (
                      <div className="mt-3">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} placeholder="Write a public reply…" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-gray-400 resize-none" />
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => saveReply(r.id)} disabled={savingId === r.id} className="text-xs font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>{savingId === r.id ? 'Saving…' : 'Post reply'}</button>
                          <button onClick={() => { setReplyId(null); setReplyText('') }} className="text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={r.response ? { backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a' } : { backgroundColor: 'rgba(249,192,0,0.16)', color: '#B45309' }}>{r.response ? 'Responded' : 'Needs reply'}</span>
                        <button onClick={() => { setReplyId(r.id); setReplyText(r.response || '') }} className="text-xs font-semibold hover:underline" style={{ color: '#00267F' }}>{r.response ? 'Edit reply' : 'Reply'}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right rail */}
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Rating breakdown</h2>
                <div className="flex flex-col gap-2">
                  {breakdown.map(b => (
                    <div key={b.star} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12 flex-shrink-0">{b.star} star</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--row-stripe)' }}>
                        <div className="h-full rounded-full" style={{ width: `${total ? (b.count / total) * 100 : 0}%`, backgroundColor: '#F9C000' }} />
                      </div>
                      <span className="text-xs text-gray-400 w-14 text-right flex-shrink-0">{b.count} ({total ? Math.round((b.count / total) * 100) : 0}%)</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-100 mt-1">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <span className="text-sm font-bold" style={{ color: '#00267F' }}>{total}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">Reputation</h2>
                <p className="text-sm text-gray-500 mb-3">{avg >= 4.5 ? 'Your reputation looks strong — keep it up.' : avg >= 4 ? 'Solid reputation. Replying to reviews builds trust.' : 'Respond to reviews and deliver great work to lift your rating.'}</p>
                <div className="flex flex-col gap-2 text-sm">
                  <span className="flex items-center gap-2 text-gray-600"><span style={{ color: avg >= 4.5 ? '#16a34a' : '#9CA3AF' }}>●</span> {avg >= 4.5 ? 'High average rating' : 'Average rating'}</span>
                  <span className="flex items-center gap-2 text-gray-600"><span style={{ color: responseRate >= 70 ? '#16a34a' : '#9CA3AF' }}>●</span> {responseRate >= 70 ? 'Good response rate' : 'Reply to more reviews'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg" style={{ backgroundColor: toast.err ? '#DC2626' : '#00267F' }}>{toast.msg}</div>}
    </main>
  )
}
