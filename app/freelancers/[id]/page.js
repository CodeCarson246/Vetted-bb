'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPriceIndicator } from '@/lib/priceIndicator'
import { formatDisplayName } from '@/lib/formatDisplayName'
import Tooltip from '@/components/Tooltip'
import WeekView from '@/components/calendar/WeekView'
import MonthView from '@/components/calendar/MonthView'
import { nowAST, getWeekStart, getWeekDays, MONTHS } from '@/components/calendar/calUtils'

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
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewService, setReviewService] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  // Report review state
  const [reportingReview, setReportingReview] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportToast, setReportToast] = useState(null)

  // Contact modal state
  const [contactOpen, setContactOpen] = useState(false)
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [contactError, setContactError] = useState(null)
  const [contactSuccess, setContactSuccess] = useState(false)

  const [availabilityBlocks, setAvailabilityBlocks] = useState([])
  const [availabilitySettings, setAvailabilitySettings] = useState(null)
  const [pubCalView, setPubCalView] = useState('week')
  const [pubWeekStart, setPubWeekStart] = useState(() => getWeekStart(nowAST()))
  const [pubCalMonth, setPubCalMonth] = useState(() => {
    const n = nowAST()
    return { year: n.getFullYear(), month: n.getMonth() }
  })

  const [services, setServices] = useState([])
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [lightboxService, setLightboxService] = useState(null)
  const [lightboxSlide, setLightboxSlide] = useState(0)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [quoteBannerDismissed, setQuoteBannerDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('quoting_banner_dismissed') === '1'
    return false
  })
  const contactBtnRef = useRef(null)

  function openLightbox(s) {
    setLightboxService(s)
    setLightboxSlide(0)
  }

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
        const [{ data: r }, { data: s }, { count: msgCount }, { data: ab }, { data: as }] = await Promise.all([
          supabase.from('reviews').select('*').eq('freelancer_id', f.id),
          supabase.from('services').select('*, service_images(id, url)').eq('freelancer_id', f.id).order('created_at', { ascending: true }),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', f.id),
          supabase.from('availability_blocks').select('*').eq('freelancer_id', f.id).order('start_time', { ascending: true }),
          supabase.from('availability_settings').select('*').eq('freelancer_id', f.id).single(),
        ])

        const allReviews = r || []

        // Compute rating + count from the live reviews rather than the
        // potentially-stale denormalized columns on the freelancers row.
        const clientRevs = allReviews.filter(rev => rev.type === 'client')
        const reviewCount = clientRevs.length
        const avgRating = reviewCount > 0
          ? Math.round((clientRevs.reduce((sum, rev) => sum + rev.rating, 0) / reviewCount) * 10) / 10
          : 0

        const freelancerRevs = allReviews.filter(rev => rev.type === 'freelancer')
        const clientRatingCount = freelancerRevs.length
        const clientRating = clientRatingCount > 0
          ? Math.round((freelancerRevs.reduce((sum, rev) => sum + rev.rating, 0) / clientRatingCount) * 10) / 10
          : 0

        setFreelancer({ ...f, rating: avgRating, review_count: reviewCount, client_rating: clientRating })
        setReviews(allReviews)
        setServices(s || [])
        setMessageCount(msgCount || 0)
        setAvailabilityBlocks(ab || [])
        setAvailabilitySettings(as || null)
      }

      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  useEffect(() => {
    const btn = contactBtnRef.current
    if (!btn) return
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(btn)
    return () => observer.disconnect()
  }, [freelancer]) // re-run once freelancer data is loaded and button is rendered

  function addToCart(service) {
    setCart(prev => {
      if (prev.find(i => i.id === service.id)) return prev
      return [...prev, service]
    })
    setCartOpen(true)
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id))
  }

  function cartTotal() {
    return cart.reduce((sum, item) => {
      const num = parseFloat(item.price?.replace(/[^0-9.]/g, ''))
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }

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
      fetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freelancerEmail: freelancer.email,
          freelancerName: freelancer.name,
          senderName,
          senderEmail,
          subject,
          message: contactMessage,
        }),
      }).catch(() => {})
      setContactSuccess(true)
      setTimeout(() => {
        setContactOpen(false)
        setContactSuccess(false)
        setSubject('')
        setContactMessage('')
        setCart([])
        setCartOpen(false)
      }, 2000)
    }
    setContactSubmitting(false)
  }

  const REVIEW_MIN_CHARS = 30

  async function submitReview(e) {
    e.preventDefault()

    // Client-side guard (mirrors server validation)
    if (reviewRating === 0) {
      setReviewError('Please select a star rating.')
      return
    }
    if (reviewComment.trim().length < REVIEW_MIN_CHARS) {
      setReviewError(`Please write at least ${REVIEW_MIN_CHARS} characters so your review is useful to others.`)
      return
    }

    setReviewSubmitting(true)
    setReviewError(null)

    let reviewerName = freelancerProfile?.name
    if (!reviewerName) {
      const { data: fp } = await supabase.from('freelancers').select('name').eq('user_id', user.id).single()
      reviewerName = fp?.name
    }
    if (!reviewerName) reviewerName = user.user_metadata?.full_name || user.email.split('@')[0]

    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        freelancer_id: freelancer.id,
        author: reviewerName,
        rating: reviewRating,
        comment: reviewComment,
        service_name: reviewService || null,
        type: 'client',
        date: new Date().toISOString().split('T')[0],
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setReviewError(result.error || 'Something went wrong. Please try again.')
    } else {
      const { data: r } = await supabase.from('reviews').select('*').eq('freelancer_id', freelancer.id)
      setReviews(r || [])

      const clientReviews = (r || []).filter(rev => rev.type === 'client')
      const newCount = clientReviews.length
      const newRating = newCount > 0
        ? Math.round((clientReviews.reduce((sum, rev) => sum + rev.rating, 0) / newCount) * 10) / 10
        : 0
      setFreelancer(prev => ({ ...prev, rating: newRating, review_count: newCount }))

      setReviewRating(0)
      setReviewComment('')
      setReviewService('')
      setReviewSuccess(true)
      setTimeout(() => setReviewSuccess(false), 3000)
    }
    setReviewSubmitting(false)
  }

  async function submitReport(e) {
    e.preventDefault()
    if (!reportReason) return
    setReportSubmitting(true)
    const { error } = await supabase.from('review_reports').insert({
      review_id: reportingReview.id,
      reporter_id: user.id,
      reason: reportReason,
      detail: reportDetail.trim() || null,
      status: 'pending',
    })
    setReportSubmitting(false)
    if (error) {
      setReportToast({ message: 'Failed to submit report. Please email us at hello@vetted.bb', type: 'error' })
    } else {
      setReportingReview(null)
      setReportReason('')
      setReportDetail('')
      setReportToast({ message: 'Report submitted. Our team will review within 48 hours.', type: 'success' })
    }
    setTimeout(() => setReportToast(null), 5000)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
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

  const whatsappShareUrl = (() => {
    const profileUrl = `https://vetted-bb.vercel.app/freelancers/${id}`
    const loc = freelancer.location ? `based in ${freelancer.location}` : 'in Barbados'
    const reviewPart = freelancer.review_count > 0
      ? ` with ${freelancer.review_count} review${freelancer.review_count === 1 ? '' : 's'}`
      : ''
    const text = `Check out ${freelancer.name} on Vetted.bb — they're a ${freelancer.trade} ${loc}${reviewPart}. ${profileUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  })()

  const jsonLd = freelancer ? {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: freelancer.name,
    description: freelancer.bio || `${freelancer.trade} based in ${freelancer.location || 'Barbados'}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: freelancer.location || 'Barbados',
      addressCountry: 'BB',
    },
    aggregateRating: freelancer.review_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: freelancer.rating,
      reviewCount: freelancer.review_count,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    url: `https://vetted-bb.vercel.app/freelancers/${freelancer.id}`,
  } : null

  return (
    <main className="min-h-screen bg-gray-50">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

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
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-24 h-24 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl font-bold border-4 border-white/30" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
                {freelancer.avatar_url
                  ? <img src={freelancer.avatar_url} alt={freelancer.name} className="w-full h-full object-cover" />
                  : freelancer.name.split(' ').map(n => n[0]).join('')}
              </div>
              {!freelancer.avatar_url && user?.id === freelancer.user_id && (
                <a href="/dashboard" className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity" style={{ color: '#F9C000' }}>
                  Add a photo
                </a>
              )}
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

                  {/* Trust signals */}
                  {(() => {
                    const createdAt = freelancer.created_at ? new Date(freelancer.created_at) : null
                    const daysOld = createdAt ? (Date.now() - createdAt.getTime()) / 86400000 : 0
                    const memberSince = createdAt && daysOld > 7
                      ? createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : null
                    const showInquiries = messageCount >= 5
                    if (!memberSince && !showInquiries) return null
                    return (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        {memberSince && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Member since {memberSince}
                          </span>
                        )}
                        {showInquiries && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {messageCount} inquiries received
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 mt-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Freelancer rating</p>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={freelancer.rating} light />
                        <span className="text-white text-sm font-semibold">{freelancer.rating}</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>({freelancer.review_count})</span>
                      </div>
                    </div>
                    {freelancer.client_rating > 0 && (
                      <div>
                        <p className="text-xs mb-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          Client rating
                          <Tooltip text="This is how previous freelancers have rated this client to work with. A high client rating means they communicate well, pay on time, and are easy to work with.">
                            <svg className="w-3 h-3 cursor-help" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </Tooltip>
                        </p>
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={freelancer.client_rating} light />
                          <span className="text-white text-sm font-semibold">{freelancer.client_rating}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: price + CTAs */}
                <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0">
                  {priceIndicator && (
                    <span className="text-sm font-bold px-3 py-1 rounded-full border-2 self-center sm:self-end" style={{ color: '#F9C000', borderColor: '#F9C000' }}>
                      {priceIndicator}
                    </span>
                  )}
                  <button
                    ref={contactBtnRef}
                    onClick={() => user ? setContactOpen(true) : window.location.href = '/login'}
                    className="font-semibold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity text-center"
                    style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                  >
                    Contact
                  </button>
                  <button
                    onClick={() => {
                      if (!user) { window.location.href = '/login'; return }
                      if (cart.length > 0) {
                        setCartOpen(true)
                      } else {
                        const firstName = freelancer.name.split(' ')[0]
                        setSubject(`Quote request — ${freelancer.trade}`)
                        setContactMessage(`Hi ${firstName}, I'd like to request a detailed quote for your services. Could you share pricing, availability, and an estimated timeline?`)
                        setContactOpen(true)
                      }
                    }}
                    className="font-semibold px-6 py-2.5 rounded-full border-2 hover:bg-white/10 transition-colors text-center"
                    style={{ borderColor: '#F9C000', color: '#F9C000' }}
                  >
                    Request a Quote
                  </button>
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-2 rounded-full font-semibold text-sm text-white hover:opacity-90 transition-opacity text-center"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Share on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Gold accent stripe */}
        <div className="h-1" style={{ backgroundColor: '#F9C000' }} />
      </div>

      {/* How quoting works — dismissible strip */}
      {!quoteBannerDismissed && (
        <div className="border-b border-gray-100" style={{ backgroundColor: '#F5F7FF' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 flex items-start gap-2.5">
            <span className="text-base flex-shrink-0 leading-none mt-0.5">⚡</span>
            <p className="text-xs text-gray-500 flex-1 leading-relaxed">
              You can request a detailed quote from this professional. They'll respond with pricing, timeline, and a PDF you can download.
            </p>
            <button
              onClick={() => {
                setQuoteBannerDismissed(true)
                localStorage.setItem('quoting_banner_dismissed', '1')
              }}
              className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 text-lg leading-none ml-1 mt-0.5"
              aria-label="Dismiss"
            >×</button>
          </div>
        </div>
      )}

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
                  className={`border border-gray-100 rounded-xl overflow-hidden flex flex-col transition-colors ${s.service_images?.length > 0 ? 'cursor-pointer hover:border-gray-400' : 'hover:border-gray-300'}`}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#00267F'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = ''}
                  onClick={() => s.service_images?.length > 0 && openLightbox(s)}
                >
                  {s.service_images?.length > 0 && (
                    <div className="relative flex overflow-hidden" style={{ height: '160px' }}>
                      {s.service_images.slice(0, 2).map((img, i) => (
                        <img
                          key={img.id}
                          src={img.url}
                          alt={`${s.name} photo ${i + 1}`}
                          className="h-40 object-cover flex-shrink-0"
                          style={{ width: s.service_images.length === 1 ? '100%' : '50%' }}
                          onError={e => {
                            e.currentTarget.style.display = 'none'
                            const ph = e.currentTarget.parentNode.querySelector('.img-unavailable')
                            if (ph) ph.style.display = 'flex'
                          }}
                        />
                      ))}
                      {/* Broken-image fallback — hidden until onError fires */}
                      <div
                        className="img-unavailable h-40 flex-shrink-0 items-center justify-center text-xs text-gray-400 font-medium"
                        style={{ display: 'none', backgroundColor: '#f3f4f6', width: '100%' }}
                      >
                        Photo unavailable
                      </div>
                      {s.service_images.length > 2 && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                          +{s.service_images.length - 2} more
                        </div>
                      )}
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
                        <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">⏱ {s.duration}</span>
                      )}
                    </div>
                    {user && user.id !== freelancer.user_id && (
                      <button
                        onClick={e => { e.stopPropagation(); addToCart(s) }}
                        disabled={!!cart.find(i => i.id === s.id)}
                        className="w-full mt-3 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={cart.find(i => i.id === s.id)
                          ? { backgroundColor: '#EEF2FF', color: '#00267F', cursor: 'default' }
                          : { backgroundColor: '#00267F', color: 'white' }}
                      >
                        {cart.find(i => i.id === s.id) ? '✓ In your quote' : '+ Add to Quote'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        {(() => {
          const mode = availabilitySettings?.mode
          const showCal = availabilitySettings?.show_on_profile

          // mode = 'available' → green card
          if (mode === 'available') {
            return (
              <div className="bg-white rounded-xl border border-gray-100 px-7 py-6">
                <h2 className="text-base font-bold text-gray-900 mb-4">Availability</h2>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#15803d', fontSize: '0.9rem', marginBottom: '4px' }}>Available</p>
                    <p style={{ fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.6 }}>
                      Available for new projects — contact me to discuss your requirements.
                    </p>
                    <button
                      onClick={() => setContactOpen(true)}
                      style={{
                        marginTop: '12px', padding: '9px 20px', borderRadius: '8px',
                        backgroundColor: '#00267F', color: 'white',
                        fontFamily: "'Sora', sans-serif", fontWeight: 600,
                        fontSize: '0.85rem', border: 'none', cursor: 'pointer',
                      }}
                    >
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          // mode = 'calendar' but hidden → show nothing
          if (mode === 'calendar' && !showCal) return null

          // mode = 'calendar' and showCal → read-only calendar
          if (mode === 'calendar' && showCal) {
            const pubWeekDays = getWeekDays(pubWeekStart)
            const pubNavLabel = pubCalView === 'week'
              ? `Week of ${pubWeekDays[0].toLocaleDateString('en-BB', { month: 'short', day: 'numeric' })}`
              : `${MONTHS[pubCalMonth.month]} ${pubCalMonth.year}`

            return (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-7 py-6 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">Availability</h2>
                </div>

                {/* Toolbar */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(0,38,127,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '10px', flexWrap: 'wrap',
                }}>
                  {/* Week / Month toggle */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['week', 'month'].map(v => (
                      <button
                        key={v}
                        onClick={() => setPubCalView(v)}
                        style={{
                          padding: '5px 13px', borderRadius: '7px', fontSize: '0.78rem',
                          fontWeight: 600, cursor: 'pointer', border: 'none',
                          backgroundColor: pubCalView === v ? '#00267F' : '#f3f4f6',
                          color: pubCalView === v ? 'white' : '#6B7280',
                        }}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Navigation */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        if (pubCalView === 'week') {
                          const d = new Date(pubWeekStart); d.setDate(d.getDate() - 7); setPubWeekStart(d)
                        } else {
                          setPubCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 })
                        }
                      }}
                      style={{ width: 28, height: 28, borderRadius: '7px', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#374151' }}
                    >←</button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', minWidth: '140px', textAlign: 'center' }}>
                      {pubNavLabel}
                    </span>
                    <button
                      onClick={() => {
                        if (pubCalView === 'week') {
                          const d = new Date(pubWeekStart); d.setDate(d.getDate() + 7); setPubWeekStart(d)
                        } else {
                          setPubCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 })
                        }
                      }}
                      style={{ width: 28, height: 28, borderRadius: '7px', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#374151' }}
                    >→</button>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: 'white', border: '1px solid #e5e7eb' }} />
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Available</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#9CA3AF' }} />
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Busy</span>
                    </div>
                  </div>
                </div>

                {/* Grid (read-only) */}
                {pubCalView === 'week' ? (
                  <WeekView
                    weekDays={pubWeekDays}
                    blocks={availabilityBlocks}
                    isPublic={true}
                  />
                ) : (
                  <MonthView
                    year={pubCalMonth.year}
                    month={pubCalMonth.month}
                    blocks={availabilityBlocks}
                    isPublic={true}
                    onDayClick={day => { setPubWeekStart(getWeekStart(day)); setPubCalView('week') }}
                  />
                )}

                {/* Footer note */}
                <p style={{
                  fontSize: '0.72rem', color: '#9CA3AF',
                  padding: '10px 20px 14px', textAlign: 'center',
                }}>
                  {availabilityBlocks.length === 0
                    ? 'No blocks set — likely available. Contact to confirm.'
                    : 'Availability is updated by the professional. Contact them to confirm.'}
                </p>
              </div>
            )
          }

          return null
        })()}

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
                          {formatDisplayName(review.author)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{formatDisplayName(review.author)}</p>
                          <p className="text-xs text-gray-400">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StarRating rating={review.rating} />
                        {user?.id === freelancer?.user_id && (
                          <button
                            onClick={() => { setReportingReview(review); setReportReason(''); setReportDetail('') }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
                          >
                            Report
                          </button>
                        )}
                      </div>
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
                      <option key={s.id} value={s.name}>{s.name} ({s.price})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
                <textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience working with this freelancer..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white resize-none text-sm"
                />
                <p className="text-xs mt-1.5" style={{ color: reviewComment.trim().length >= REVIEW_MIN_CHARS ? '#16a34a' : '#6b7280' }}>
                  {reviewComment.trim().length}/{REVIEW_MIN_CHARS} characters minimum
                </p>
              </div>

              {reviewError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{reviewError}</p>
              )}
              {reviewSuccess && (
                <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">Review submitted. Thank you!</p>
              )}

              <button
                type="submit"
                disabled={reviewSubmitting || reviewRating === 0 || reviewComment.trim().length < REVIEW_MIN_CHARS}
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

      {/* Contact modal */}
      {/* Estimate cart */}
      {cart.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-40 w-full max-w-sm"
          style={{ transform: 'translateX(-50%)' }}
        >
          {cartOpen ? (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid rgba(0,38,127,0.1)' }}>
              {/* Cart header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#00267F' }}>
                <div>
                  <p className="text-white font-semibold text-sm">Your estimate</p>
                  <p className="text-xs mt-0.5" style={{ color: '#93b8ff' }}>{cart.length} service{cart.length > 1 ? 's' : ''} selected</p>
                </div>
                <button onClick={() => setCartOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
              </div>
              {/* Cart items */}
              <div className="px-5 py-3 flex flex-col gap-2 max-h-52 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      {item.duration && <p className="text-xs text-gray-400">{item.duration}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: '#00267F' }}>{item.price}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors">×</button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Cart total + submit */}
              <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                {cartTotal() > 0 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Estimated total</span>
                    <span className="text-base font-bold" style={{ color: '#00267F' }}>${cartTotal().toFixed(0)}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mb-3">Final prices are agreed directly with the freelancer.</p>
                <button
                  onClick={() => {
                    const serviceList = cart.map(i => `• ${i.name}: ${i.price}`).join('\n')
                    const total = cartTotal() > 0 ? `\n\nEstimated total: $${cartTotal().toFixed(0)}` : ''
                    const msg = `Hi ${freelancer.name.split(' ')[0]}, I am interested in the following services:\n\n${serviceList}${total}\n\nCould you confirm availability and pricing?`
                    setSenderName(senderName || '')
                    setSubject(`Service enquiry — ${cart.length} service${cart.length > 1 ? 's' : ''}`)
                    setContactMessage(msg)
                    setContactOpen(true)
                    setCartOpen(false)
                  }}
                  className="w-full py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#F9C000', color: '#00267F' }}
                >
                  Send estimate to {freelancer.name.split(' ')[0]} →
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCartOpen(true)}
              className="mx-auto flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm shadow-lg"
              style={{ backgroundColor: '#00267F', color: 'white', boxShadow: '0 4px 20px rgba(0,38,127,0.35)' }}
            >
              <span style={{ backgroundColor: '#F9C000', color: '#00267F', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                {cart.length}
              </span>
              View estimate
            </button>
          )}
        </div>
      )}

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
      {lightboxService && (() => {
        const imgs = lightboxService.service_images
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') setLightboxSlide(i => (i + 1) % imgs.length)
              if (e.key === 'ArrowLeft') setLightboxSlide(i => (i - 1 + imgs.length) % imgs.length)
              if (e.key === 'Escape') setLightboxService(null)
            }}
            tabIndex={0}
            ref={el => el && el.focus()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-white font-bold text-lg">{lightboxService.name}</h3>
                <p className="text-white/50 text-sm">{lightboxSlide + 1} / {imgs.length}</p>
              </div>
              <button
                onClick={() => setLightboxService(null)}
                className="text-white/70 hover:text-white text-3xl leading-none transition-colors"
              >×</button>
            </div>

            {/* Main image */}
            <div className="flex-1 flex items-center justify-center px-4 relative min-h-0">
              <img
                src={imgs[lightboxSlide].url}
                alt={`${lightboxService.name} photo ${lightboxSlide + 1}`}
                className="max-h-full max-w-full rounded-xl object-contain"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
                onError={e => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextSibling?.style && (e.currentTarget.nextSibling.style.display = 'flex')
                }}
              />
              <div
                className="rounded-xl items-center justify-center text-sm text-white/50 font-medium"
                style={{ display: 'none', width: '300px', height: '200px', backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                Photo unavailable
              </div>
              {imgs.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxSlide(i => (i - 1 + imgs.length) % imgs.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold hover:bg-white/20 transition-colors"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >‹</button>
                  <button
                    onClick={() => setLightboxSlide(i => (i + 1) % imgs.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold hover:bg-white/20 transition-colors"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >›</button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {imgs.length > 1 && (
              <div className="flex-shrink-0 flex gap-2 justify-center px-6 py-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {imgs.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxSlide(i)}
                    className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
                    style={{
                      width: '60px',
                      height: '60px',
                      opacity: i === lightboxSlide ? 1 : 0.45,
                      outline: i === lightboxSlide ? '2px solid #F9C000' : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.parentNode.style.backgroundColor = 'rgba(255,255,255,0.08)'
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Sticky bottom action bar — mobile only, shown when header Contact is out of view */}
      {stickyVisible && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white px-4 py-3 flex gap-2" style={{ borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
          <button
            onClick={() => user ? setContactOpen(true) : window.location.href = '/login'}
            className="flex-1 py-3 rounded-full font-semibold text-sm border-2 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#00267F', color: '#00267F' }}
          >
            Message
          </button>
          <button
            onClick={() => {
              if (cart.length > 0) {
                setCartOpen(true)
              } else {
                const firstName = freelancer.name.split(' ')[0]
                setSubject(`Quote request — ${freelancer.trade}`)
                setContactMessage(`Hi ${firstName}, I'd like to request a quote for your services. Could you let me know your availability and pricing?`)
                setContactOpen(true)
              }
            }}
            className="flex-1 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
          >
            {cart.length > 0 ? `View estimate (${cart.length})` : 'Request a Quote'}
          </button>
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 flex-shrink-0 flex items-center justify-center rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#25D366' }}
            aria-label="Share on WhatsApp"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>
      )}

      {/* Report review modal */}
      {reportingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setReportingReview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-7" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 mb-5">Report this review</h2>
            <form onSubmit={submitReport} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                <select
                  required
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white text-sm"
                >
                  <option value="">Select a reason</option>
                  <option value="This review is fake or spam">This review is fake or spam</option>
                  <option value="This reviewer never hired me">This reviewer never hired me</option>
                  <option value="This contains offensive language">This contains offensive language</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional detail <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={reportDetail}
                  onChange={e => setReportDetail(e.target.value)}
                  rows={3}
                  placeholder="Any extra context for our team..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white resize-none text-sm"
                />
              </div>
              <div className="flex gap-3 mt-1">
                <button
                  type="submit"
                  disabled={reportSubmitting || !reportReason}
                  className="flex-1 py-3 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  style={{ backgroundColor: '#00267F' }}
                >
                  {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => setReportingReview(null)}
                  className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:border-gray-400 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report toast */}
      {reportToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg text-white ${reportToast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {reportToast.message}
        </div>
      )}
    </main>
  )
}
