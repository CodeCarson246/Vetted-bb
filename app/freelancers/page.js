'use client'
import { useState, useEffect } from 'react'
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
  const [freelancer, setFreelancer] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: f } = await supabase
        .from('freelancers')
        .select('*')
        .eq('name', 'Marcus Williams')
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
    fetchData()
  }, [])

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
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <a href="/" className="text-2xl font-bold text-blue-600">Vetted.bb</a>
        <div className="flex gap-4">
          <button className="text-gray-600 hover:text-gray-900 font-medium">Log in</button>
          <button className="bg-blue-600 text-white px-5 py-2 rounded-full font-medium hover:bg-blue-700">Sign up</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">

        <div className="bg-white rounded-2xl p-8 mb-6 border border-gray-100">
          <div className="flex gap-6 items-start">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600 flex-shrink-0">
              {freelancer.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{freelancer.name}</h1>
                  <p className="text-blue-600 font-medium">{freelancer.trade}</p>
                  <p className="text-gray-500 text-sm mt-1">{freelancer.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{freelancer.hourly_rate}<span className="text-sm text-gray-500 font-normal">/hr</span></p>
                  <button className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700">Contact</button>
                </div>
              </div>

              <div className="flex gap-6 mt-4">
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
          <h2 className="text-lg font-bold text-gray-900 mb-6">Reviews</h2>
          <div className="flex flex-col gap-4">
            {reviews.map((review, i) => (
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
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${review.type === 'client' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                      {review.type === 'client' ? 'Client review' : 'Freelancer review'}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                </div>
                <p className="text-gray-600 text-sm">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
