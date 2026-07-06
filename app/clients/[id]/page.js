'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatDisplayName } from '@/lib/formatDisplayName'

function StarRating({ rating, light = false }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={`text-sm ${star <= Math.round(rating) ? 'text-yellow-400' : light ? 'text-white/30' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

export default function ClientProfile() {
  const { id } = useParams()
  const { loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (authLoading || !id) return
    async function load() {
      // RLS decides visibility: owner, contacted freelancers, or public.
      const { data: p } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle()

      if (!p) {
        setVisible(false)
        setLoading(false)
        return
      }
      setProfile(p)

      const { data: revs } = await supabase
        .from('reviews')
        .select('rating, comment, date, created_at, freelancers(id, name, trade)')
        .eq('client_user_id', id)
        .eq('type', 'freelancer')
        .order('created_at', { ascending: false })
      setReviews(revs || [])
      setLoading(false)
    }
    load()
  }, [id, authLoading])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  if (!visible) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center max-w-md">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" className="mx-auto mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="font-medium text-gray-900 mb-1">This profile is private</p>
          <p className="text-sm text-gray-500">
            Client profiles are visible to freelancers they&apos;ve contacted, unless the client chooses to make theirs public.
          </p>
        </div>
      </main>
    )
  }

  const count = reviews.length
  const avg = count > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
    : 0
  const freelancersWorkedWith = new Set(reviews.map(r => r.freelancers?.id).filter(Boolean)).size
  const name = profile.display_name || 'Vetted.bb client'
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <main className="min-h-screen page-bg">
      {/* Hero */}
      <div className="w-full" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', boxShadow: '0 0 0 4px rgba(249,192,0,0.45)' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-white capitalize">{formatDisplayName(name)}</h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
                  Client
                </span>
              </div>
              {memberSince && (
                <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Member since {memberSince}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Client rating</p>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={avg} light />
                    <span className="text-white text-sm font-semibold">{count > 0 ? avg : '—'}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>({count} review{count === 1 ? '' : 's'})</span>
                  </div>
                </div>
                {freelancersWorkedWith > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Freelancers worked with</p>
                    <p className="text-white text-sm font-semibold">{freelancersWorkedWith}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Gold accent stripe */}
      <div style={{ height: 4, background: '#F9C000' }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <h2 className="font-semibold text-gray-900 mb-4">What freelancers say</h2>
        {count === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center">
            <p className="text-sm text-gray-500">No freelancer reviews yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} />
                    <span className="text-sm font-semibold text-gray-800">{r.rating}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at || r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                {r.freelancers && (
                  <Link href={`/freelancers/${r.freelancers.id}`} className="text-xs font-medium mt-2 inline-block hover:opacity-80" style={{ color: '#00267F' }}>
                    — {r.freelancers.name}, <span className="capitalize">{r.freelancers.trade}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
