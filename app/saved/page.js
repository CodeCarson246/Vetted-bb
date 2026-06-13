'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatParish } from '@/lib/formatParish'

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={`text-sm ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

export default function SavedProfessionals() {
  const router = useRouter()
  const { user: authUser, loading: authLoading } = useAuth()
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!authUser) { router.push('/login'); return }

    // freelancers(*) rather than an explicit column list — survives schema
    // differences (naming a column that doesn't exist 400s the whole query)
    supabase
      .from('saved_professionals')
      .select('id, freelancer_id, created_at, freelancers(*)')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        // A saved row can outlive its freelancer if the profile was deleted
        setSaved((data || []).filter(row => row.freelancers))
        setLoading(false)
      })
  }, [authUser, authLoading, router])

  async function removeSaved(rowId) {
    setRemovingId(rowId)
    const { error } = await supabase.from('saved_professionals').delete().eq('id', rowId)
    if (!error) setSaved(prev => prev.filter(r => r.id !== rowId))
    setRemovingId(null)
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
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved professionals</h1>
            <p className="text-sm text-gray-500 mt-1">Your shortlist — compare and reach out when you&apos;re ready.</p>
          </div>
          <span className="text-sm text-gray-500 flex-shrink-0">{saved.length} saved</span>
        </div>

        {saved.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" className="mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <p className="font-medium text-gray-900 mb-1">Nothing saved yet</p>
            <p className="text-sm text-gray-500 mb-6">Tap the heart on any professional&apos;s card to keep them here.</p>
            <a
              href="/search"
              className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Browse professionals →
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {saved.map(row => {
              const f = row.freelancers
              const initials = f.name ? f.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'
              return (
                <div key={row.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow" style={{ borderLeft: '4px solid #00267F' }}>
                  {/* Avatar */}
                  <a href={`/freelancers/${f.id}`} className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold" style={{ background: f.avatar_url ? undefined : '#00267F' }}>
                      {f.avatar_url
                        ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                        : initials}
                    </div>
                  </a>

                  {/* Info */}
                  <a href={`/freelancers/${f.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold capitalize" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{f.name}</span>
                      {f.verified && (
                        <span className="chip" style={{ fontSize: '0.7rem', fontWeight: 700 }}>✓ Vetted</span>
                      )}
                      <span className={`text-xs font-medium ${f.available ? 'text-green-600' : 'text-gray-400'}`}>
                        ● {f.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 capitalize mt-0.5">
                      {f.trade}{f.location ? ` · ${formatParish(f.location)}` : ''}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StarRating rating={f.rating || 0} />
                      <span className="text-xs text-gray-400">({f.review_count || 0})</span>
                    </div>
                  </a>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                    <a
                      href={`/freelancers/${f.id}`}
                      className="text-xs font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#00267F' }}
                    >
                      View profile
                    </a>
                    <button
                      onClick={() => removeSaved(row.id)}
                      disabled={removingId === row.id}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {removingId === row.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
