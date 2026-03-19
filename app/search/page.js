'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={star <= Math.round(rating) ? "text-yellow-400 text-sm" : "text-gray-200 text-sm"}>★</span>
      ))}
    </div>
  )
}

function SearchPage() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [freelancers, setFreelancers] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setQuery(q)
  }, [searchParams])

  useEffect(() => {
    async function fetchFreelancers() {
      const { data } = await supabase.from('freelancers').select('*')
      setFreelancers(data || [])
      setLoading(false)
    }
    fetchFreelancers()
  }, [])

  const [sortBy, setSortBy] = useState('rating')

  const filtered = freelancers
    .filter(f =>
      query === '' ||
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.trade.toLowerCase().includes(query.toLowerCase()) ||
      f.skills.some(s => s.toLowerCase().includes(query.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'price_low') return parseInt(a.hourly_rate.slice(1)) - parseInt(b.hourly_rate.slice(1))
      if (sortBy === 'price_high') return parseInt(b.hourly_rate.slice(1)) - parseInt(a.hourly_rate.slice(1))
      if (sortBy === 'reviews') return b.review_count - a.review_count
      return 0
    })

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <a href="/" className="text-2xl font-bold text-blue-600">Vetted.bb</a>
        <div className="flex gap-4 items-center">
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
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, trade or skill..."
            className="flex-1 px-5 py-3 border border-gray-200 rounded-full text-gray-900 outline-none focus:border-blue-400 bg-white"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-5 py-3 border border-gray-200 rounded-full text-gray-700 outline-none focus:border-blue-400 bg-white"
          >
            <option value="rating">Top rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">Loading freelancers...</p>
          </div>
        ) : (
          <>
        <p className="text-sm text-gray-500 mb-6">{filtered.length} freelancer{filtered.length !== 1 ? 's' : ''} found</p>

        <div className="flex flex-col gap-4">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-medium">No freelancers found for "{query}"</p>
              <p className="text-sm mt-2">Try a different search term</p>
            </div>
          ) : (
            filtered.map(f => (
              <a href={`/freelancers/${f.id}`} key={f.id} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all block">
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 flex-shrink-0">
                    {f.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900">{f.name}</h3>
                          {f.available ? (
                            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Available</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Unavailable</span>
                          )}
                        </div>
                        <p className="text-blue-600 text-sm font-medium">{f.trade} · {f.location}</p>
                      </div>
                      <p className="font-bold text-gray-900">${f.hourly_rate}<span className="text-sm text-gray-400 font-normal">/hr</span></p>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <StarRating rating={f.rating} />
                        <span className="text-sm font-medium text-gray-700">{f.rating}</span>
                        <span className="text-xs text-gray-400">({f.review_count})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>Client rating:</span>
                        <span className="font-medium text-gray-700">{f.client_rating}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {f.skills.map(skill => (
                        <span key={skill} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
          </>
        )}
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-8">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
export default function Search() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  )
}