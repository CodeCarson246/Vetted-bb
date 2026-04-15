'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SearchEmptyState from '@/components/SearchEmptyState'
import Tooltip from '@/components/Tooltip'

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
  const [category, setCategory] = useState('')
  const [freelancers, setFreelancers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = searchParams.get('q')
    const cat = searchParams.get('category')
    if (q) setQuery(q)
    if (cat) setCategory(cat)
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
  const [availability, setAvailability] = useState('all')
  const [budget, setBudget] = useState('all')
  const [location, setLocation] = useState('')

  const locations = [...new Set(freelancers.map(f => f.location).filter(Boolean))].sort()

  const activeFilterCount = [
    availability !== 'all',
    budget !== 'all',
    location !== '',
  ].filter(Boolean).length

  function clearFilters() {
    setQuery('')
    setCategory('')
    setAvailability('all')
    setBudget('all')
    setLocation('')
  }

  const filtered = freelancers
    .filter(f => {
      if (query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean)
        const haystack = [f.name, f.trade, f.category || '', ...(f.skills || [])].join(' ').toLowerCase()
        if (!words.some(w => haystack.includes(w))) return false
      }
      if (availability === 'available' && !f.available) return false
      if (budget !== 'all' && f.min_price != null) {
        const p = parseFloat(f.min_price)
        if (budget === 'u100'  && p >= 100)  return false
        if (budget === 'u250'  && p >= 250)  return false
        if (budget === 'u500'  && p >= 500)  return false
        if (budget === 'u1000' && p >= 1000) return false
        if (budget === 'o1000' && p < 1000)  return false
      }
      if (location && f.location !== location) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'price_low')  return (a.min_price ?? Infinity) - (b.min_price ?? Infinity)
      if (sortBy === 'price_high') return (b.min_price ?? -Infinity) - (a.min_price ?? -Infinity)
      if (sortBy === 'reviews') return b.review_count - a.review_count
      return 0
    })

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="w-full py-8 px-4 sm:px-8" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Find a freelancer</h1>
          <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Browse trusted professionals across Barbados</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">

        {/* Search + filter card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, trade or skill..."
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-400 bg-white text-sm"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-lg text-gray-700 outline-none focus:border-gray-400 bg-white text-sm"
            >
              <option value="rating">Top rated</option>
              <option value="reviews">Most reviewed</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Availability */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAvailability('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${availability === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={availability === 'all' ? { backgroundColor: '#00267F' } : {}}
              >
                All
              </button>
              <button
                onClick={() => setAvailability('available')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${availability === 'available' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={availability === 'available' ? { backgroundColor: '#00267F' } : {}}
              >
                Available only
              </button>
            </div>

            <div className="w-px h-4 bg-gray-200 hidden sm:block" />

            {/* Budget filter */}
            <select
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-700 outline-none focus:border-gray-400 bg-white"
            >
              <option value="all">Any budget</option>
              <option value="u100">Under $100</option>
              <option value="u250">Under $250</option>
              <option value="u500">Under $500</option>
              <option value="u1000">Under $1,000</option>
              <option value="o1000">$1,000+</option>
            </select>

            <div className="w-px h-4 bg-gray-200 hidden sm:block" />

            {/* Location */}
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-700 outline-none focus:border-gray-400 bg-white"
            >
              <option value="">All locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* Active count + clear */}
            {(activeFilterCount > 0 || query) && (
              <div className="flex items-center gap-2 ml-auto">
                {activeFilterCount > 0 && (
                  <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: '#00267F' }}>
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 animate-pulse">
                <div className="flex gap-5 items-start">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, j) => (
                            <div key={j} className="w-3.5 h-3.5 bg-gray-200 rounded" />
                          ))}
                          <div className="w-8 h-3.5 bg-gray-200 rounded ml-1" />
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <div className="h-6 bg-gray-200 rounded-full w-16" />
                          <div className="h-6 bg-gray-200 rounded-full w-20" />
                          <div className="h-6 bg-gray-200 rounded-full w-14" />
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        <div className="h-5 bg-gray-200 rounded w-16" />
                        <div className="h-4 bg-gray-200 rounded w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">{filtered.length} freelancer{filtered.length !== 1 ? 's' : ''} found</p>

            {filtered.length === 0 ? (
              <SearchEmptyState query={query} category={category} />
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(f => (
                  <a
                    href={`/freelancers/${f.id}`}
                    key={f.id}
                    className="group bg-white rounded-xl p-6 border border-gray-100 border-l-4 hover:border-l-4 hover:shadow-md transition-all block"
                    style={{ borderLeftColor: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.borderLeftColor = '#00267F'}
                    onMouseLeave={e => e.currentTarget.style.borderLeftColor = 'transparent'}
                  >
                    <div className="flex gap-5 items-start">
                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                        {f.avatar_url
                          ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                          : f.name.split(' ').map(n => n[0]).join('')}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {/* Name + availability dot */}
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-bold text-gray-900 leading-tight capitalize">{f.name}</h3>
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.available ? 'bg-green-400' : 'bg-gray-300'}`} />
                                <span className={`text-xs font-medium ${f.available ? 'text-green-600' : 'text-gray-400'}`}>
                                  {f.available ? 'Available' : 'Unavailable'}
                                </span>
                              </span>
                            </div>
                            {/* Company name */}
                            {f.company_name && f.company_name.trim().length > 3 && (
                              <p className="text-sm text-gray-500">{f.company_name}</p>
                            )}
                            {/* Trade + location */}
                            <p className="text-sm font-medium mt-0.5 capitalize" style={{ color: '#00267F' }}>
                              {f.trade}
                              {f.location && <span className="text-gray-400 font-normal capitalize"> · 📍 {f.location}</span>}
                            </p>
                          </div>

                          {/* From $X price indicator */}
                          {f.min_price != null && (
                            <span className="flex-shrink-0 text-xs font-medium text-gray-400 whitespace-nowrap">
                              From ${Number.isInteger(f.min_price) ? f.min_price : parseFloat(f.min_price).toFixed(0)}
                            </span>
                          )}
                        </div>

                        {/* Rating row */}
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex items-center gap-1">
                            <StarRating rating={f.rating} />
                            <span className="text-sm font-semibold text-gray-800 ml-0.5">{f.rating}</span>
                            <span className="text-xs text-gray-400">({f.review_count})</span>
                          </div>
                          {f.client_rating > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              · Client reputation: <span className="font-medium text-gray-600">{f.client_rating}</span>
                              <Tooltip text="How freelancers rate this client to work with">
                                <svg className="w-3 h-3 cursor-help text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                              </Tooltip>
                            </span>
                          )}
                        </div>

                        {/* Skills — max 3 */}
                        {f.skills?.length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {f.skills.slice(0, 3).map(skill => (
                              <span key={skill} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>{skill}</span>
                            ))}
                            {f.skills.length > 3 && (
                              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-500">+{f.skills.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

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
