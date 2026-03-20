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
  const [menuOpen, setMenuOpen] = useState(false)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      if (u && u.user_metadata?.role !== 'client') {
        const { data: fp } = await supabase.from('freelancers').select('id, name, avatar_url').eq('user_id', u.id).single()
        setFreelancerProfile(fp || null)
        if (fp) {
          const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', fp.id).eq('read', false)
          setUnreadCount(count || 0)
        }
      }
    })
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
  const [availability, setAvailability] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [location, setLocation] = useState('')

  const locations = [...new Set(freelancers.map(f => f.location).filter(Boolean))].sort()

  const activeFilterCount = [
    availability !== 'all',
    minPrice !== '',
    maxPrice !== '',
    location !== '',
  ].filter(Boolean).length

  function clearFilters() {
    setQuery('')
    setAvailability('all')
    setMinPrice('')
    setMaxPrice('')
    setLocation('')
  }

  const filtered = freelancers
    .filter(f => {
      if (query && !(
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.trade.toLowerCase().includes(query.toLowerCase()) ||
        f.skills.some(s => s.toLowerCase().includes(query.toLowerCase()))
      )) return false
      if (availability === 'available' && !f.available) return false
      const rate = parseFloat(f.hourly_rate)
      if (minPrice !== '' && rate < parseFloat(minPrice)) return false
      if (maxPrice !== '' && rate > parseFloat(maxPrice)) return false
      if (location && f.location !== location) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'price_low') return parseFloat(a.hourly_rate) - parseFloat(b.hourly_rate)
      if (sortBy === 'price_high') return parseFloat(b.hourly_rate) - parseFloat(a.hourly_rate)
      if (sortBy === 'reviews') return b.review_count - a.review_count
      return 0
    })

  return (
    <main className="min-h-screen bg-gray-50">
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
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user?.user_metadata?.full_name || user.email}</a>
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
                <a
                  href="/signup"
                  className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Sign up
                </a>
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
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name || user.email}</a>
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

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">

        {/* Search + sort row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, trade or skill..."
            className="flex-1 px-5 py-3 border border-gray-200 rounded-full text-gray-900 outline-none focus:border-gray-400 bg-white"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-5 py-3 border border-gray-200 rounded-full text-gray-700 outline-none focus:border-gray-400 bg-white"
          >
            <option value="rating">Top rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">

          {/* Availability */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAvailability('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${availability === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={availability === 'all' ? { backgroundColor: '#00267F' } : {}}
            >
              All
            </button>
            <button
              onClick={() => setAvailability('available')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${availability === 'available' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={availability === 'available' ? { backgroundColor: '#00267F' } : {}}
            >
              Available only
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200 hidden sm:block" />

          {/* Price range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">Price</span>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="w-20 pl-6 pr-2 py-1.5 border border-gray-200 rounded-full text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                />
              </div>
              <span className="text-gray-400 text-sm">–</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="w-20 pl-6 pr-2 py-1.5 border border-gray-200 rounded-full text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="w-px h-5 bg-gray-200 hidden sm:block" />

          {/* Location */}
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="px-4 py-1.5 border border-gray-200 rounded-full text-sm text-gray-700 outline-none focus:border-gray-400 bg-white"
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
                className="text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
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
                  <p className="font-medium">No freelancers match your filters</p>
                  <p className="text-sm mt-2">Try adjusting your search or filters</p>
                </div>
              ) : (
                filtered.map(f => (
                  <a href={`/freelancers/${f.id}`} key={f.id} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all block">
                    <div className="flex gap-4 items-start">
                      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center font-bold flex-shrink-0 overflow-hidden" style={{ color: '#00267F' }}>
                        {f.avatar_url
                          ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                          : f.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900">{f.name}</h3>
                              {f.available ? (
                                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">Available</span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Unavailable</span>
                              )}
                            </div>
                            <p className="text-sm font-medium" style={{ color: '#00267F' }}>{f.trade} · {f.location}</p>
                          </div>
                          <p className="font-bold text-gray-900 sm:text-right">${f.hourly_rate}<span className="text-sm text-gray-400 font-normal">/hr</span></p>
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
                            <span key={skill} className="text-xs bg-blue-50 px-2 py-1 rounded-full" style={{ color: '#00267F' }}>{skill}</span>
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
