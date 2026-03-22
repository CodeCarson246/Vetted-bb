'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPriceIndicator } from '@/lib/priceIndicator'

function displayName(author) {
  if (!author) return ''
  return author.includes('@') ? author.split('@')[0] : author
}

function StarRating({ rating, light = false }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={`text-sm ${star <= Math.round(rating) ? 'text-yellow-400' : light ? 'text-white/30' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

export default function FreelancerProfile() {
  const { id } = useParams()
  const [freelancer, setFreelancer] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('client')
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewService, setReviewService] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  // Contact modal state
  const [contactOpen, setContactOpen] = useState(false)
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState(null)
  const [contactSuccess, setContactSuccess] = useState(false)

  const [unreadCount, setUnreadCount] = useState(0)
  const [services, setServices] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      if (u) {
        setSenderEmail(u.email)
        if (u.user_metadata?.role !== 'client') {
          const { data: fp } = await supabase.from('freelancers').select('id, name, avatar_url').eq('user_id', u.id).single()
          setFreelancerProfile(fp || null)
          setSenderName(fp?.name || u.user_metadata?.full_name || u.email.split('@')[0])
          if (fp) {
            const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', fp.id).eq('read', false)
            setUnreadCount(count || 0)
          }
        } else {
          setSenderName(u.user_metadata?.full_name || u.email.split('@')[0])
        }
      }
    })
  }, [])

  useEffect(() => {
    async function fetchData() {
      const { data: f } = await supabase
        .from('freelancers')
        .select('*')
        .eq('id', id)
        .single()

      if (f) {
        const [{ data: r }, { data: s }] = await Promise.all([
          supabase.from('reviews').select('*').eq('freelancer_id', f.id),
          supabase.from('services').select('*, service_images(id, url)').eq('freelancer_id', f.id).order('created_at', { ascending: true }),
        ])
        setFreelancer(f)
        setReviews(r || [])
        setServices(s || [])
      }

      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  async function submitContact(e) {
    e.preventDefault()
    setContactSubmitting(true)
    setContactError(null)

    const { error } = await supabase.from('messages').insert({
      freelancer_id: freelancer.id,
      sender_name: senderName,
      sender_email: senderEmail,
      subject,
      message: contactMessage,
      created_at: new Date().toISOString(),
      read: false,
    })

    if (error) {
      setContactError(error.message)
    } else {
      setContactSuccess(true)
      setTimeout(() => {
        setContactOpen(false)
        setContactSuccess(false)
        setSubject('')
        setContactMessage('')
      }, 2000)
    }
    setContactSubmitting(false)
  }

  async function submitReview(e) {
    e.preventDefault()
    setReviewSubmitting(true)
    setReviewError(null)

    let reviewerName = freelancerProfile?.name
    if (!reviewerName) {
      const { data: fp } = await supabase.from('freelancers').select('name').eq('user_id', user.id).single()
      reviewerName = fp?.name
    }
    if (!reviewerName) reviewerName = user.user_metadata?.full_name || user.email.split('@')[0]

    const { error } = await supabase.from('reviews').insert({
      freelancer_id: freelancer.id,
      author: reviewerName,
      rating: reviewRating,
      comment: reviewComment,
      service_name: reviewService || null,
      type: 'client',
      date: new Date().toISOString().split('T')[0],
    })

    if (error) {
      setReviewError(error.message)
    } else {
      const { data: r } = await supabase.from('reviews').select('*').eq('freelancer_id', freelancer.id)
      setReviews(r || [])

      const clientReviews = (r || []).filter(rev => rev.type === 'client')
      const newCount = clientReviews.length
      const newRating = newCount > 0
        ? Math.round((clientReviews.reduce((sum, rev) => sum + rev.rating, 0) / newCount) * 10) / 10
        : 0

      await supabase.from('freelancers').update({ rating: newRating, review_count: newCount }).eq('id', freelancer.id)
      setFreelancer(prev => ({ ...prev, rating: newRating, review_count: newCount }))

      setReviewRating(0)
      setReviewComment('')
      setReviewService('')
      setReviewSuccess(true)
      setTimeout(() => setReviewSuccess(false), 3000)
    }
    setReviewSubmitting(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-8 py-5">
            <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          </div>
        </nav>
        <div className="w-full" style={{ backgroundColor: '#00267F' }}>
          <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10 animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="w-24 h-24 rounded-full flex-shrink-0 border-4" style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }} />
              <div className="flex-1 min-w-0">
                <div className="h-7 rounded w-48 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="h-5 rounded w-32 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="h-4 rounded w-24 mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div className="flex gap-5">
                  <div className="h-4 rounded w-32" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <div className="h-4 rounded w-28" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                </div>
              </div>
            </div>
          </div>
          <div className="h-1" style={{ backgroundColor: '#F9C000' }} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-gray-100 border-l-4 overflow-hidden animate-pulse" style={{ borderLeftColor: '#00267F' }}>
            <div className="px-7 py-6">
              <div className="h-5 bg-gray-200 rounded w-16 mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-4/6" />
              </div>
              <div className="flex gap-2 mt-5">
                <div className="h-7 bg-gray-200 rounded-full w-16" />
                <div className="h-7 bg-gray-200 rounded-full w-20" />
                <div className="h-7 bg-gray-200 rounded-full w-14" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="px-7 pt-6 pb-6">
              <div className="h-5 bg-gray-200 rounded w-20 mb-4" />
              <div className="flex gap-2 mb-6">
                <div className="h-8 bg-gray-200 rounded-full w-44" />
                <div className="h-8 bg-gray-200 rounded-full w-36" />
              </div>
              <div className="flex flex-col gap-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-5">
                    <div className="flex gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-1.5" />
                        <div className="h-3 bg-gray-200 rounded w-20" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!freelancer) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Freelancer not found.</p>
      </main>
    )
  }

  const clientReviewsList = reviews.filter(r => r.type === 'client')
  const freelancerReviewsList = reviews.filter(r => r.type === 'freelancer')
  const priceIndicator = getPriceIndicator(freelancer.hourly_rate)

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          <div className="hidden sm:flex gap-4 items-center">
            {user ? (
              <>
                {freelancerProfile ? (
                  <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user?.user_metadata?.full_name || user?.email}</a>
                )}
                {freelancerProfile && (
                  <a href="/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                )}
                <button
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                  className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
                <a href="/signup" className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
          <button className="sm:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
            {user ? (
              <>
                {freelancerProfile ? (
                  <a href="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name || user?.email}</a>
                )}
                {freelancerProfile && (
                  <a href="/inbox" className="flex items-center gap-2 text-gray-700 font-medium">
                    Inbox
                    {unreadCount > 0 && (
                      <span className="min-w-[18px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                )}
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-left text-red-500 font-medium">Log out</button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-700 font-medium">Log in</a>
                <a href="/signup" className="font-medium" style={{ color: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-8 py-2.5">
        <a
          href="/search"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to search
        </a>
      </div>

      {/* ── Hero banner ── */}
      <div className="w-full" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">

            {/* Avatar */}
            <div className="w-24 h-24 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold border-4 border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
              {freelancer.avatar_url
                ? <img src={freelancer.avatar_url} alt={freelancer.name} className="w-full h-full object-cover" />
                : freelancer.name.split(' ').map(n => n[0]).join('')}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white capitalize">{freelancer.name}</h1>
                  <p className="font-semibold mt-0.5 capitalize" style={{ color: '#F9C000' }}>{freelancer.trade}</p>
                  {freelancer.location && (
                    <p className="text-sm mt-0.5 capitalize" style={{ color: '#93b8ff' }}>📍 {freelancer.location}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 mt-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Freelancer rating</p>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={freelancer.rating} light />
                        <span className="text-white text-sm font-semibold">{freelancer.rating}</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>({freelancer.review_count})</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Client rating</p>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={freelancer.client_rating} light />
                        <span className="text-white text-sm font-semibold">{freelancer.client_rating}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: price + contact */}
                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-3 flex-shrink-0">
                  {priceIndicator && (
                    <span className="text-sm font-bold px-3 py-1 rounded-full border-2" style={{ color: '#F9C000', borderColor: '#F9C000' }}>
                      {priceIndicator}
                    </span>
                  )}
                  <button
                    onClick={() => user ? setContactOpen(true) : window.location.href = '/login'}
                    className="font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    Contact
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Gold accent stripe */}
        <div className="h-1" style={{ backgroundColor: '#F9C000' }} />
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">

        {/* About */}
        <div className="bg-white rounded-xl border border-gray-100 border-l-4 overflow-hidden" style={{ borderLeftColor: '#00267F' }}>
          <div className="px-7 py-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 leading-relaxed text-sm">{freelancer.bio}</p>
            {(freelancer.skills || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {(freelancer.skills || []).map(skill => (
                  <span key={skill} className="text-xs px-3 py-1 rounded-full border font-medium" style={{ color: '#00267F', borderColor: '#00267F' }}>{skill}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 px-7 py-6">
            <h2 className="text-base font-bold text-gray-900 mb-5">Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map(s => (
                <div
                  key={s.id}
                  className="border border-gray-100 rounded-xl overflow-hidden flex flex-col hover:border-gray-300 transition-colors"
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#00267F'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = ''}
                >
                  {s.service_images?.length > 0 && (
                    <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                      {s.service_images.map((img, i) => (
                        <img
                          key={img.id}
                          src={img.url}
                          alt={`${s.name} photo ${i + 1}`}
                          className="h-40 w-48 object-cover flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                  <div className="p-5 flex flex-col gap-2 flex-1">
                    <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-gray-500 leading-relaxed flex-1">{s.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3">
                      <span className="text-lg font-bold" style={{ color: '#00267F' }}>{s.price}</span>
                      {s.duration && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{s.duration}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-7 pt-6 pb-0">
            <h2 className="text-base font-bold text-gray-900 mb-4">Reviews</h2>
            <div className="flex gap-2">
              {[
                { key: 'client', label: 'About this freelancer', count: clientReviewsList.length },
                ...(freelancerReviewsList.length > 0 ? [{ key: 'freelancer', label: 'Their client reviews', count: freelancerReviewsList.length }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${activeTab === tab.key ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  style={activeTab === tab.key ? { backgroundColor: '#00267F' } : {}}
                >
                  {tab.label} <span className="ml-1 opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-7 py-6">
            {reviews.filter(r => r.type === activeTab).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No reviews yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.filter(r => r.type === activeTab).map((review, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                          {displayName(review.author)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{displayName(review.author)}</p>
                          <p className="text-xs text-gray-400">{review.date}</p>
                        </div>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.service_name && (
                      <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-2" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                        {review.service_name}
                      </span>
                    )}
                    <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leave a review */}
        {user && freelancer && user.id !== freelancer.user_id && (
          <div className="bg-white rounded-xl border border-gray-100 px-7 py-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Leave a review</h2>
            <p className="text-sm text-gray-500 mb-6">Share your experience working with <span className="capitalize">{freelancer.name.split(' ')[0]}</span>.</p>

            <form onSubmit={submitReview} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      className="text-4xl leading-none transition-colors focus:outline-none"
                    >
                      <span className={(reviewHover || reviewRating) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    </button>
                  ))}
                </div>
              </div>

              {services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Service <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={reviewService}
                    onChange={e => setReviewService(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white text-sm"
                  >
                    <option value="">Select the service you used</option>
                    {services.map(s => (
                      <option key={s.id} value={s.name}>{s.name} — {s.price}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience working with this freelancer..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white resize-none text-sm"
                />
              </div>

              {reviewError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{reviewError}</p>
              )}
              {reviewSuccess && (
                <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">Review submitted — thank you!</p>
              )}

              <button
                type="submit"
                disabled={reviewSubmitting || reviewRating === 0}
                className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#00267F' }}
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit review'}
              </button>
            </form>
          </div>
        )}

        {!user && (
          <div className="bg-white rounded-xl border border-gray-100 px-7 py-6">
            <p className="text-sm text-gray-500">
              <a href="/login" className="font-medium underline" style={{ color: '#00267F' }}>Log in</a>
              {' '}to leave a review for this freelancer.
            </p>
          </div>
        )}

      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-4">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs">
          <a href="/search" className="hover:text-gray-600 transition-colors">Browse freelancers</a>
          <a href="/signup" className="hover:text-gray-600 transition-colors">List your services</a>
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </div>
      </footer>

      {/* Contact modal */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setContactOpen(false) }}
        >
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl">
            {contactSuccess ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-3">✅</p>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Message sent!</h3>
                <p className="text-sm text-gray-500">Your message has been delivered to {freelancer.name}.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Contact {freelancer.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{freelancer.trade} · {freelancer.location}</p>
                  </div>
                  <button
                    onClick={() => setContactOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={submitContact} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
                      <input
                        type="email"
                        required
                        value={senderEmail}
                        onChange={e => setSenderEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="e.g. Looking for a plumber this weekend"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      required
                      value={contactMessage}
                      onChange={e => setContactMessage(e.target.value)}
                      rows={4}
                      placeholder={`Hi ${freelancer.name}, I'd like to get in touch about...`}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white resize-none"
                    />
                  </div>

                  {contactError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{contactError}</p>
                  )}

                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setContactOpen(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:border-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className="flex-1 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#00267F' }}
                    >
                      {contactSubmitting ? 'Sending...' : 'Send message'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
