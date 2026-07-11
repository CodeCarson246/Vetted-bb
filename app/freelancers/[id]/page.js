'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatDisplayName } from '@/lib/formatDisplayName'
import { formatParish } from '@/lib/formatParish'
import { parsePrice } from '@/lib/price'
import { formatResponseTime } from '@/lib/formatResponseTime'
import { useSaved } from '@/lib/useSaved'
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge'
import BookingWidget from '@/components/BookingWidget'
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
  const [reviewImageUrl, setReviewImageUrl] = useState('')
  const [reviewImageUploading, setReviewImageUploading] = useState(false)
  const [reviewPhotoLightbox, setReviewPhotoLightbox] = useState(null)
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
  const [portfolioItems, setPortfolioItems] = useState([])
  const [portfolioLightbox, setPortfolioLightbox] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false) // mobile bar share popover
  const [servicesHighlight, setServicesHighlight] = useState(false)
  const [lightboxService, setLightboxService] = useState(null)
  const [lightboxSlide, setLightboxSlide] = useState(0)
  const [stickyVisible, setStickyVisible] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [responseStats, setResponseStats] = useState(null)
  const [quoteBannerDismissed, setQuoteBannerDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('quoting_banner_dismissed') === '1'
    return false
  })
  const contactBtnRef = useRef(null)
  const lightboxRef = useRef(null)

  // Focus the lightbox once when it opens (so Escape works) — a callback
  // ref would re-steal focus on every render.
  useEffect(() => {
    if (reviewPhotoLightbox) lightboxRef.current?.focus()
  }, [reviewPhotoLightbox])

  function openLightbox(s) {
    setLightboxService(s)
    setLightboxSlide(0)
  }

  const { user: authUser, session, loading: authLoading } = useAuth()
  const { savedIds, toggleSaved } = useSaved()

  useEffect(() => {
    if (authLoading) return
    const u = authUser
    setUser(u)
    if (!u) return
    setSenderEmail(u.email)
    if (u.user_metadata?.role !== 'client') {
      supabase.from('freelancers').select('id, name, avatar_url').eq('user_id', u.id).single().then(({ data: fp }) => {
        setFreelancerProfile(fp || null)
        setSenderName(fp?.name || u.user_metadata?.full_name || u.email.split('@')[0])
      })
    } else {
      setSenderName(u.user_metadata?.full_name || u.email.split('@')[0])
    }
  }, [authUser, authLoading])

  useEffect(() => {
    async function fetchData() {
      const { data: f } = await supabase
        .from('freelancers')
        .select('*')
        .eq('id', id)
        .single()

      if (f) {
        // Message contents are private under RLS; the inquiry count used
        // for social proof comes from a security-definer function instead.
        const [{ data: r }, { data: s }, { data: msgCount }, { data: ab }, { data: as }, { data: portfolio }, { data: respStats }] = await Promise.all([
          supabase.from('reviews').select('*').eq('freelancer_id', f.id),
          supabase.from('services').select('*, service_images(id, url)').eq('freelancer_id', f.id).order('created_at', { ascending: true }),
          supabase.rpc('freelancer_message_count', { f_id: f.id }),
          supabase.from('availability_blocks').select('*').eq('freelancer_id', f.id).order('start_time', { ascending: true }),
          supabase.from('availability_settings').select('*').eq('freelancer_id', f.id).single(),
          supabase.from('portfolio_items').select('*').eq('freelancer_id', f.id).order('created_at', { ascending: true }),
          supabase.rpc('freelancer_response_stats', { f_id: f.id }),
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
        setPortfolioItems(portfolio || [])
        setMessageCount(msgCount || 0)
        setResponseStats(Array.isArray(respStats) ? respStats[0] : respStats)
        setAvailabilityBlocks(ab || [])
        setAvailabilitySettings(as || null)
      }

      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  // Record a profile view for the freelancer's analytics — skips the
  // owner viewing themselves and repeat views within a browser session.
  useEffect(() => {
    if (!freelancer || authLoading) return
    if (authUser && authUser.id === freelancer.user_id) return
    const key = `pv_${freelancer.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* private browsing — count the view anyway */ }
    supabase.from('profile_views').insert({ freelancer_id: freelancer.id }).then(() => {})
  }, [freelancer, authUser, authLoading])

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
    return cart.reduce((sum, item) => sum + (parsePrice(item.price) ?? 0), 0)
  }

  // "Request a Quote" with an empty estimate: a quote request must carry at
  // least one service, so instead of opening a contentless message we send the
  // client to the Services section and highlight it to pick services. Once a
  // service is added the cart drawer drives the itemised enquiry flow.
  function promptSelectServices() {
    const el = document.getElementById('services-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setServicesHighlight(true)
      setTimeout(() => setServicesHighlight(false), 2400)
    }
  }

  async function submitContact(e) {
    e.preventDefault()
    setContactSubmitting(true)
    setContactError(null)

    // NOTE: Existing duplicate threads created before this deduplication fix can be
    // manually merged or removed in Supabase if desired. Going forward, all new
    // messages between the same client (matched by email) and freelancer are grouped
    // into one thread instead of creating separate threads per entry point.

    // Step 1 — Check for an existing thread between this client and freelancer
    const { data: existingThreads } = await supabase
      .from('messages')
      .select('id')
      .eq('freelancer_id', freelancer.id)
      .eq('sender_email', senderEmail)
      .order('created_at', { ascending: true })
      .limit(1)

    const existingThread = existingThreads?.[0] || null

    let error

    if (existingThread) {
      // Step 2 — Thread exists: append as a reply with an inquiry-type label.
      // Quote requests always travel as itemised "service enquiry" messages
      // built by the estimate drawer; free-form Contact messages are plain.
      const inquiryLabel = subject.toLowerCase().includes('enquiry')
        ? '--- New service enquiry ---'
        : '--- New message ---'

      const { error: replyError } = await supabase.from('message_replies').insert({
        message_id: existingThread.id,
        sender_name: senderName,
        sender_user_id: user?.id ?? null,
        body: `${inquiryLabel}\n\n${contactMessage}`,
      })
      error = replyError

      if (!replyError) {
        // Mark thread as unread so the freelancer is notified of the new inquiry
        await supabase.from('messages').update({ read: false }).eq('id', existingThread.id)
      }
    } else {
      // Step 3 — No existing thread: create a new message row as normal (first contact)
      const { error: insertError } = await supabase.from('messages').insert({
        freelancer_id: freelancer.id,
        sender_name: senderName,
        sender_email: senderEmail,
        sender_user_id: user?.id ?? null,
        subject,
        message: contactMessage,
        created_at: new Date().toISOString(),
        read: false,
      })
      error = insertError
    }

    if (error) {
      setContactError(error.message)
    } else {
      fetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freelancer_id: freelancer.id,
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

  async function handleReviewImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setReviewError('Photo must be a JPG, PNG or WebP under 5MB.')
      return
    }
    setReviewImageUploading(true)
    setReviewError(null)
    // Random sanitized filename — never put raw user filenames in storage paths
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${freelancer.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('review-photos')
      .upload(path, file, { upsert: false })
    if (uploadError) {
      setReviewError('Photo upload failed. You can still submit without a photo.')
    } else {
      const { data: { publicUrl } } = supabase.storage.from('review-photos').getPublicUrl(path)
      setReviewImageUrl(publicUrl)
    }
    setReviewImageUploading(false)
  }

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

    // Identity (author name, user id, date) is derived server-side from
    // the JWT — the API rejects unauthenticated calls.
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        freelancer_id: freelancer.id,
        rating: reviewRating,
        comment: reviewComment,
        service_name: reviewService || null,
        image_url: reviewImageUrl || null,
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
      setReviewImageUrl('')
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
                  <div key={i} className="rounded-2xl p-5" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
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

  // Hidden or deactivated profiles are unavailable to everyone except their
  // owner (who sees the real page, plus a notice that it's offline). Wait for
  // auth to settle so the owner doesn't flash the unavailable state.
  const profileOffline = !!(freelancer.hidden || freelancer.deactivated_at)
  const isOwner = user?.id === freelancer.user_id
  if (profileOffline && !authLoading && !isOwner) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3" aria-hidden="true">🔒</p>
          <h1 className="text-lg font-bold text-gray-900 mb-1">This profile is currently unavailable</h1>
          <p className="text-sm text-gray-500 mb-5">The professional has taken their listing offline. You can find other trusted pros in the meantime.</p>
          <Link href="/search" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
            Browse professionals
          </Link>
        </div>
      </main>
    )
  }

  const clientReviewsList = reviews.filter(r => r.type === 'client')
  const freelancerReviewsList = reviews.filter(r => r.type === 'freelancer')
  // Capitalised first name for the review headings (DB names can be lowercase)
  const reviewFirstName = (() => {
    const n = (freelancer.name || '').split(' ')[0]
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'this pro'
  })()
  const whatsappShareUrl = (() => {
    const profileUrl = `https://vetted-bb.vercel.app/freelancers/${id}`
    const loc = freelancer.location ? `based in ${formatParish(freelancer.location)}` : 'in Barbados'
    const reviewPart = freelancer.review_count > 0
      ? ` with ${freelancer.review_count} review${freelancer.review_count === 1 ? '' : 's'}`
      : ''
    const text = `Check out ${freelancer.name} on Vetted.bb. They're a ${freelancer.trade} ${loc}${reviewPart}. ${profileUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  })()

  const profileShareUrl = `https://vetted-bb.vercel.app/freelancers/${id}`
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileShareUrl)}`
  const xShareUrl = (() => {
    const text = `Check out ${freelancer.name} on Vetted.bb, a ${freelancer.trade} in ${formatParish(freelancer.location) || 'Barbados'}.`
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileShareUrl)}`
  })()

  // Brand icons shared by the desktop card + mobile share popover
  const WhatsAppIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
  const FacebookIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
  const XIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )

  const jsonLd = freelancer ? {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: freelancer.name,
    description: freelancer.bio || `${freelancer.trade} based in ${formatParish(freelancer.location) || 'Barbados'}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: formatParish(freelancer.location) || 'Barbados',
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
    <main className="min-h-screen page-bg">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Owner-only reminder that this listing is offline to everyone else */}
      {profileOffline && isOwner && (
        <div style={{ backgroundColor: '#FEF9EC', borderBottom: '1px solid #F9C000', padding: '10px 16px', textAlign: 'center' }}>
          <span className="text-sm" style={{ color: '#92400e' }}>
            {freelancer.deactivated_at
              ? 'Your account is deactivated. Only you can see this profile.'
              : 'Your profile is hidden. Only you can see it. '}
            {!freelancer.deactivated_at && (
              <Link href="/settings" className="font-semibold underline underline-offset-2" style={{ color: '#92400e' }}>Unhide in Settings</Link>
            )}
          </span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-8 py-2.5">
        <Link
          href={user?.id === freelancer.user_id ? '/dashboard' : '/search'}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {user?.id === freelancer.user_id ? 'Back to dashboard' : 'Back to search'}
        </Link>
      </div>

      {/* ── Hero banner ── */}
      <div className="w-full" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-start gap-7">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              {freelancer.avatar_url ? (
                <img
                  src={freelancer.avatar_url}
                  alt={freelancer.name}
                  className="w-32 h-32 object-cover flex-shrink-0"
                  style={{ display: 'block', borderRadius: '50%', border: '3px solid #F9C000' }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full flex-shrink-0 flex items-center justify-center text-4xl font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '3px solid #F9C000' }}>
                  {freelancer.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              {!freelancer.avatar_url && user?.id === freelancer.user_id && (
                <Link href="/dashboard?edit=true" className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity" style={{ color: '#F9C000' }}>
                  Add a photo
                </Link>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-white capitalize">{freelancer.name}</h1>
                    {isVerified(freelancer) && <VerifiedBadge size={20} withLabel />}
                  </div>
                  {freelancer.company_name && freelancer.company_name.trim().length > 3 && (
                    <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{freelancer.company_name}</p>
                  )}
                  <p className="font-semibold mt-0.5 capitalize" style={{ color: '#F9C000' }}>{freelancer.trade}</p>
                  {freelancer.location && (
                    <p className="text-sm mt-0.5 capitalize" style={{ color: '#93b8ff' }}>📍 {formatParish(freelancer.location)}</p>
                  )}

                  {/* Trust signals */}
                  {(() => {
                    const createdAt = freelancer.created_at ? new Date(freelancer.created_at) : null
                    const daysOld = createdAt ? (Date.now() - createdAt.getTime()) / 86400000 : 0
                    const memberSince = createdAt && daysOld > 7
                      ? createdAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : null
                    const showInquiries = messageCount >= 5
                    // "Typically replies within X" — only with a meaningful sample
                    const rs = responseStats
                    const showResponse = rs && rs.sample >= 3 && rs.median_minutes != null
                    const responseText = showResponse ? formatResponseTime(rs.median_minutes) : null
                    if (!memberSince && !showInquiries && !showResponse) return null
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
                        {showResponse && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {responseText}
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

                {/* Right: services-from pill + CTAs — uniform width */}
                <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-52">
                  {services.length > 0 && (() => {
                    const minSvc = services.reduce((acc, s) => {
                      const n = parsePrice(s.price)
                      if (n === null) return acc
                      if (!acc) return s
                      return n < parsePrice(acc.price) ? s : acc
                    }, null)
                    if (!minSvc) return null
                    const n = parsePrice(minSvc.price)
                    if (n === null) return null
                    const fmt = `$${Number.isInteger(n) ? n : n.toFixed(0)}`
                    const isStarting = minSvc.price_type === 'starting_from'
                    return (
                      <span
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-center mb-1"
                        style={{ color: '#F9C000', border: '1px solid rgba(249,192,0,0.45)', backgroundColor: 'rgba(249,192,0,0.1)' }}
                      >
                        Services from {isStarting ? `${fmt}+` : fmt}
                      </span>
                    )
                  })()}
                  <button
                    ref={contactBtnRef}
                    onClick={() => user ? setContactOpen(true) : window.location.href = '/login'}
                    className="w-full font-semibold py-2.5 rounded-full hover:opacity-90 transition-opacity text-center text-sm"
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
                        promptSelectServices()
                      }
                    }}
                    className="w-full font-semibold py-2.5 rounded-full border-2 hover:bg-white/10 transition-colors text-center text-sm"
                    style={{ borderColor: '#F9C000', color: '#F9C000' }}
                  >
                    Request a Quote
                  </button>
                  <div className="w-full flex items-center gap-2">
                    <a
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on WhatsApp"
                      title="Share on WhatsApp"
                      className="flex-1 flex items-center justify-center py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <WhatsAppIcon className="w-5 h-5" />
                    </a>
                    <a
                      href={facebookShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on Facebook"
                      title="Share on Facebook"
                      className="flex-1 flex items-center justify-center py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#1877F2' }}
                    >
                      <FacebookIcon className="w-5 h-5" />
                    </a>
                    <a
                      href={xShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on X"
                      title="Share on X"
                      className="flex-1 flex items-center justify-center py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#0F1419' }}
                    >
                      <XIcon className="w-4 h-4" />
                    </a>
                  </div>
                  <button
                    onClick={async () => {
                      const result = await toggleSaved(freelancer.id)
                      if (result === 'login') window.location.href = '/login'
                      if (result === 'error') alert('Could not update your saved list. Please try again.')
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm border-2 transition-colors text-center"
                    style={savedIds.has(freelancer.id)
                      ? { borderColor: '#ef4444', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' }
                      : { borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}
                  >
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill={savedIds.has(freelancer.id) ? '#ef4444' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {savedIds.has(freelancer.id) ? 'Saved' : 'Save'}
                  </button>
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
        <div className="bg-white rounded-2xl overflow-hidden" style={{ borderLeft: '4px solid #00267F', borderTop: '4px solid #00267F', borderRight: '1px solid rgba(0,38,127,0.15)', borderBottom: '1px solid rgba(0,38,127,0.15)', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
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
            {freelancer.years_experience != null && (
              <p className="text-sm text-gray-400 mt-4">🗓 {freelancer.years_experience} {freelancer.years_experience === 1 ? 'year' : 'years'} of experience</p>
            )}
          </div>
        </div>

        {/* Qualifications */}
        {freelancer.qualifications && freelancer.qualifications.trim() && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ borderLeft: '4px solid #00267F', borderTop: '4px solid #00267F', borderRight: '1px solid rgba(0,38,127,0.15)', borderBottom: '1px solid rgba(0,38,127,0.15)', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
            <div className="px-7 py-6">
              <h2 className="text-base font-bold text-gray-900 mb-3">Qualifications</h2>
              <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">{freelancer.qualifications}</p>
            </div>
          </div>
        )}

        {/* Services */}
        {services.length > 0 ? (
          <div id="services-section" className="bg-white rounded-2xl px-7 py-6" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: servicesHighlight ? '0 0 0 3px rgba(249,192,0,0.6)' : '0 2px 12px rgba(0,38,127,0.08)', scrollMarginTop: '90px', transition: 'box-shadow 0.3s ease' }}>
            <h2 className="text-base font-bold text-gray-900 mb-5">Services</h2>
            {servicesHighlight && (
              <div className="mb-4 text-sm rounded-lg px-4 py-3" style={{ backgroundColor: 'rgba(249,192,0,0.12)', color: '#92400E', border: '1px solid rgba(249,192,0,0.4)' }}>
                Add one or more services below to build your estimate, then send your quote request.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map(s => (
                <div
                  key={s.id}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)', transition: 'all 0.2s ease', cursor: s.service_images?.length > 0 ? 'pointer' : 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,38,127,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,38,127,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
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
                      {(() => {
                        const n = parseFloat(String(s.price).replace(/[^0-9.]/g, ''))
                        const fmt = isNaN(n) ? s.price : `$${Number.isInteger(n) ? n : n.toFixed(2)}`
                        if (s.price_type === 'starting_from') {
                          return (
                            <span
                              className="text-lg font-bold relative group cursor-help"
                              style={{ color: '#F59E0B' }}
                            >
                              {isNaN(n) ? fmt : `${fmt}+`}
                              <span className="absolute bottom-full left-0 mb-1.5 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                Base price. Final cost depends on the job scope
                              </span>
                            </span>
                          )
                        }
                        return <span className="text-lg font-bold" style={{ color: '#00267F' }}>{fmt}</span>
                      })()}
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
        ) : user?.id === freelancer.user_id ? (
          <div className="bg-white rounded-2xl px-7 py-10 text-center" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
            <h2 className="text-base font-bold text-gray-900 mb-2">Services</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7280', fontFamily: "'Inter', sans-serif" }}>
              Add your services so clients know what you offer.
            </p>
            <Link href="/dashboard?edit=true" className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>
              Add a Service →
            </Link>
          </div>
        ) : null}

        {/* Request a booking — renders only when the freelancer enabled bookings */}
        <BookingWidget freelancerId={freelancer.id} freelancerName={freelancer.name} />

        {/* Availability */}
        {(() => {
          const mode = availabilitySettings?.mode
          const showCal = availabilitySettings?.show_on_profile

          // mode = 'available' → green card
          if (mode === 'available') {
            return (
              <div className="bg-white rounded-2xl px-7 py-6" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
                <h2 className="text-base font-bold text-gray-900 mb-4">Availability</h2>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#15803d', fontSize: '0.9rem', marginBottom: '4px' }}>Available</p>
                    <p style={{ fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.6 }}>
                      Available for new projects. Contact me to discuss your requirements.
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
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
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
                      style={{ width: 28, height: 28, borderRadius: '7px', border: '1.5px solid #e5e7eb', background: 'var(--surface-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#374151' }}
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
                      style={{ width: 28, height: 28, borderRadius: '7px', border: '1.5px solid #e5e7eb', background: 'var(--surface-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', color: '#374151' }}
                    >→</button>
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Available</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
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
                    ? 'No blocks set, likely available. Contact to confirm.'
                    : 'Availability is updated by the professional. Contact them to confirm.'}
                </p>
              </div>
            )
          }

          return null
        })()}

        {/* Previous Work */}
        {portfolioItems.length > 0 ? (
          <div className="bg-white rounded-2xl px-7 py-6" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
            <h2 className="text-base font-bold text-gray-900 mb-5">Previous Work</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolioItems.map(item => (
                <div
                  key={item.id}
                  className="group rounded-2xl overflow-hidden cursor-pointer"
                  style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,38,127,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,38,127,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  onClick={() => setPortfolioLightbox(item)}
                >
                  {/* 4:3 image */}
                  <div className="relative w-full overflow-hidden" style={{ paddingTop: '75%' }}>
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  {/* Text */}
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{item.title}</p>
                    {item.description && (
                      <>
                        {/* Mobile: always show */}
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2 sm:hidden">{item.description}</p>
                        {/* Desktop: fade in on hover (reserves space to prevent layout shift) */}
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">{item.description}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : user?.id === freelancer.user_id ? (
          <div className="bg-white rounded-2xl px-7 py-10 text-center" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
            <h2 className="text-base font-bold text-gray-900 mb-2">Previous Work</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7280', fontFamily: "'Inter', sans-serif" }}>
              Add previous work to show clients what you can do.
            </p>
            <Link href="/dashboard?edit=true" className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>
              Add to Portfolio →
            </Link>
          </div>
        ) : null}

        {/* Reviews */}
        <div className="bg-white rounded-2xl" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
          <div className="px-7 pt-6 pb-0">
            <h2 className="text-base font-bold text-gray-900 mb-1">Reviews &amp; ratings</h2>
            {freelancerReviewsList.length > 0 && (
              <p className="text-xs text-gray-500 mb-4" style={{ lineHeight: 1.5 }}>
                On Vetted.bb ratings go both ways: clients rate the professional, and the professional rates the clients they work with.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'client', label: `How clients rate ${reviewFirstName}`, count: clientReviewsList.length },
                ...(freelancerReviewsList.length > 0 ? [{ key: 'freelancer', label: `How ${reviewFirstName} rates clients`, count: freelancerReviewsList.length }] : []),
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
            <p className="text-xs text-gray-400 mt-3">
              {activeTab === 'client'
                ? `Ratings left by clients who hired ${reviewFirstName}.`
                : `Ratings ${reviewFirstName} left for clients after working with them.`}
            </p>
          </div>

          <div className="px-7 py-6">
            {reviews.filter(r => r.type === activeTab).length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center gap-4">
                <p className="text-sm leading-relaxed max-w-sm" style={{ color: '#6B7280', fontFamily: "'Inter', sans-serif" }}>
                  No reviews yet. Be the first: send {freelancer.name.split(' ')[0]} a message to get started.
                </p>
                <button
                  onClick={() => user ? setContactOpen(true) : window.location.href = '/login'}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Send a Message
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.filter(r => r.type === activeTab).map((review, i) => (
                  <div key={i} className="rounded-2xl p-5" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {review.service_name && (
                        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                          {review.service_name}
                        </span>
                      )}
                      {review.image_url && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Photo
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mt-2">{review.comment}</p>
                    {review.image_url && (
                      <img
                        src={review.image_url}
                        alt={`Photo from ${review.reviewer_name || review.author}`}
                        className="mt-3 rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ width: '100%', maxWidth: '320px', height: 'auto', borderRadius: '12px', marginTop: '12px' }}
                        onClick={() => setReviewPhotoLightbox(review.image_url)}
                      />
                    )}
                    {review.response && (
                      <div className="mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#F1F5FF', borderLeft: '3px solid #00267F' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#00267F' }}>
                          Response from {freelancer.company_name?.trim().length > 3 ? freelancer.company_name : freelancer.name}
                        </p>
                        <p className="text-gray-600 text-sm leading-relaxed">{review.response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Leave a review */}
        {user && freelancer && user.id !== freelancer.user_id && (
          <div id="leave-review" className="bg-white rounded-2xl px-7 py-6" style={{ border: '1px solid rgba(0,38,127,0.15)', borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
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
                      <option key={s.id} value={s.name}>{s.name} ({(() => { const n = parseFloat(String(s.price).replace(/[^0-9.]/g, '')); const fmt = isNaN(n) ? s.price : `$${Number.isInteger(n) ? n : n.toFixed(2)}`; return s.price_type === 'starting_from' ? `${fmt}+` : fmt })()})</option>
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

              {/* Photo upload — optional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Add a photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">Show the work that was done. This helps other clients and builds trust.</p>
                {reviewImageUrl ? (
                  <div className="flex flex-col items-start gap-2">
                    <img
                      src={reviewImageUrl}
                      alt="Review photo preview"
                      className="rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '160px', width: 'auto' }}
                      onClick={() => setReviewPhotoLightbox(reviewImageUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => setReviewImageUrl('')}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >Remove</button>
                  </div>
                ) : (
                  <label
                    className={`flex flex-col items-center justify-center gap-1.5 w-full cursor-pointer transition-colors ${reviewImageUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                      border: '2px dashed rgba(0,38,127,0.2)',
                      borderRadius: '12px',
                      padding: '20px',
                      textAlign: 'center',
                      background: 'rgba(0,38,127,0.02)',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📷</span>
                    <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                      {reviewImageUploading ? 'Uploading...' : 'Upload a photo of the work done'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>JPG, PNG or WebP · Max 5MB</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={reviewImageUploading} onChange={handleReviewImageUpload} />
                  </label>
                )}
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
              <Link href="/login" className="font-medium underline" style={{ color: '#00267F' }}>Log in</Link>
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
                      <span className="text-sm font-bold" style={{ color: item.price_type === 'starting_from' ? '#F59E0B' : '#00267F' }}>
                        {(() => { const n = parseFloat(String(item.price).replace(/[^0-9.]/g, '')); const fmt = isNaN(n) ? item.price : `$${Number.isInteger(n) ? n : n.toFixed(2)}`; return item.price_type === 'starting_from' ? `${fmt}+` : fmt })()}
                      </span>
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
                    const serviceList = cart.map(i => {
                      const n = parsePrice(i.price)
                      const priceText = n !== null ? `$${Number.isInteger(n) ? n : n.toFixed(2)}` : i.price
                      return `• ${i.name}: ${priceText}`
                    }).join('\n')
                    const total = cartTotal() > 0 ? `\n\nEstimated total: $${cartTotal().toFixed(0)}` : ''
                    const msg = `Hi ${freelancer.name.split(' ')[0]}, I am interested in the following services:\n\n${serviceList}${total}\n\nCould you confirm availability and pricing?`
                    setSenderName(senderName || '')
                    setSubject(`Service enquiry: ${cart.length} service${cart.length > 1 ? 's' : ''}`)
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
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
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
                    <p className="text-sm text-gray-500 mt-0.5">{freelancer.trade} · {formatParish(freelancer.location)}</p>
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
            className="fixed inset-0 z-[200] flex flex-col"
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

      {/* Review photo lightbox */}
      {reviewPhotoLightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setReviewPhotoLightbox(null)}
          onKeyDown={e => e.key === 'Escape' && setReviewPhotoLightbox(null)}
          tabIndex={-1}
          ref={lightboxRef}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={reviewPhotoLightbox}
              alt="Review photo"
              className="w-full rounded-xl object-contain"
              style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            />
            <button
              onClick={() => setReviewPhotoLightbox(null)}
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white text-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}

      {/* Portfolio lightbox */}
      {portfolioLightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPortfolioLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={portfolioLightbox.image_url}
              alt={portfolioLightbox.title}
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 'calc(100vh - 160px)' }}
            />
            <div className="mt-3 text-center">
              <p className="text-white font-semibold">{portfolioLightbox.title}</p>
              {portfolioLightbox.description && (
                <p className="text-gray-300 text-sm mt-1">{portfolioLightbox.description}</p>
              )}
            </div>
            <button
              onClick={() => setPortfolioLightbox(null)}
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white text-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}

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
              if (!user) { window.location.href = '/login'; return }
              if (cart.length > 0) {
                setCartOpen(true)
              } else {
                promptSelectServices()
              }
            }}
            className="flex-1 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
          >
            {cart.length > 0 ? `View estimate (${cart.length})` : 'Request a Quote'}
          </button>
          <div className="relative w-12 flex-shrink-0">
            {shareOpen && (
              <div
                className="absolute bottom-full right-0 mb-3 flex items-center gap-2 rounded-full p-2"
                style={{ backgroundColor: 'var(--surface-card, #fff)', boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border-card, #e5e7eb)' }}
              >
                <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" onClick={() => setShareOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-white" style={{ backgroundColor: '#25D366' }}>
                  <WhatsAppIcon className="w-5 h-5" />
                </a>
                <a href={facebookShareUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" onClick={() => setShareOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-white" style={{ backgroundColor: '#1877F2' }}>
                  <FacebookIcon className="w-5 h-5" />
                </a>
                <a href={xShareUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on X" onClick={() => setShareOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full text-white" style={{ backgroundColor: '#0F1419' }}>
                  <XIcon className="w-4 h-4" />
                </a>
              </div>
            )}
            <button
              onClick={() => setShareOpen(o => !o)}
              className="w-12 h-full flex items-center justify-center rounded-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: shareOpen ? '#001a5c' : '#00267F' }}
              aria-label="Share this profile"
              aria-expanded={shareOpen}
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Report review modal */}
      {reportingReview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setReportingReview(null)}>
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
