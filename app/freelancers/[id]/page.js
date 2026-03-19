'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function StarRating({ rating }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={star <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}>★</span>
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
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    async function fetchData() {
      const { data: f } = await supabase
        .from('freelancers')
        .select('*')
        .eq('id', id)
        .single()

      if (f) {
        const { data: r } = await supabase
          .from('reviews')
          .select('*')
          .eq('freelancer_id', f.id)

        setFreelancer(f)
        setReviews(r || [])
      }

      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  async function submitReview(e) {
    e.preventDefault()
    setReviewSubmitting(true)
    setReviewError(null)

    const { error } = await supabase.from('reviews').insert({
      freelancer_id: freelancer.id,
      author: user.email,
      rating: reviewRating,
      comment: reviewComment,
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
      setReviewSuccess(true)
      setTimeout(() => setReviewSuccess(false), 3000)
    }
    setReviewSubmitting(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
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

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <a href="/" className="text-2xl font-bold text-blue-600">Vetted.bb</a>
          <div className="hidden sm:flex gap-4 items-center">
            {user ? (
              <>
                <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user.email}</a>
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">Dashboard</a>
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700">Log out</button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
                <a href="/signup" className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700">Sign up</a>
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
                <a href="/dashboard" className="text-gray-600 text-sm font-medium">{user.email}</a>
                <a href="/dashboard" className="text-gray-700 font-medium">Dashboard</a>
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-left text-red-500 font-medium">Log out</button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-700 font-medium">Log in</a>
                <a href="/signup" className="text-blue-600 font-medium">Sign up</a>
              </>
            )}
          </div>
        )}
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">

        <div className="bg-white rounded-2xl p-6 sm:p-8 mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600 flex-shrink-0">
              {freelancer.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{freelancer.name}</h1>
                  <p className="text-blue-600 font-medium">{freelancer.trade}</p>
                  <p className="text-gray-500 text-sm mt-1">{freelancer.location}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-2xl font-bold text-gray-900">${freelancer.hourly_rate}<span className="text-sm text-gray-500 font-normal">/hr</span></p>
                  <button className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700">Contact</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Freelancer rating</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={freelancer.rating} />
                    <span className="font-semibold text-gray-900">{freelancer.rating}</span>
                    <span className="text-gray-400 text-sm">({freelancer.review_count} reviews)</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Client rating</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={freelancer.client_rating} />
                    <span className="font-semibold text-gray-900">{freelancer.client_rating}</span>
                    <span className="text-gray-400 text-sm">(rated by freelancers)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 mb-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
          <p className="text-gray-600 leading-relaxed">{freelancer.bio}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {(freelancer.skills || []).map(skill => (
              <span key={skill} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">{skill}</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Reviews</h2>
          <div className="flex gap-1 mb-6 border-b border-gray-100">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'client' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Reviews about me
            </button>
            <button
              onClick={() => setActiveTab('freelancer')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'freelancer' ? 'text-blue-600 border-b-2 border-blue-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Their client reviews
            </button>
          </div>
          <div className="flex flex-col gap-4">
            {reviews.filter(r => r.type === activeTab).map((review, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {review.author[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{review.author}</p>
                      <p className="text-xs text-gray-400">{review.date}</p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                <p className="text-gray-600 text-sm">{review.comment}</p>
              </div>
            ))}
            {reviews.filter(r => r.type === activeTab).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No reviews yet.</p>
            )}
          </div>
        </div>

        {user && (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Leave a review</h2>
            <form onSubmit={submitReview} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      className="text-3xl leading-none transition-colors"
                    >
                      <span className={(reviewHover || reviewRating) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience working with this freelancer..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-blue-400 bg-white resize-none"
                />
              </div>

              {reviewError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{reviewError}</p>
              )}
              {reviewSuccess && (
                <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3">Review submitted — thank you!</p>
              )}

              <button
                type="submit"
                disabled={reviewSubmitting || reviewRating === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reviewSubmitting ? 'Submitting...' : 'Submit review'}
              </button>
            </form>
          </div>
        )}

      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
