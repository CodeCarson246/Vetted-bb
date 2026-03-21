'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPriceIndicator } from '@/lib/priceIndicator'

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
  const [priceRange, setPriceRange] = useState('all')
  const [location, setLocation] = useState('')

  const locations = [...new Set(freelancers.map(f => f.location).filter(Boolean))].sort()

  const activeFilterCount = [
    availability !== 'all',
    priceRange !== 'all',
    location !== '',
  ].filter(Boolean).length

  function clearFilters() {
    setQuery('')
    setAvailability('all')
    setPriceRange('all')
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
      if (priceRange !== 'all') {
        const rate = parseFloat(f.hourly_rate)
        if (priceRange === '$' && rate >= 30) return false
        if (priceRange === '$$' && (rate < 30 || rate >= 60)) return false
        if (priceRange === '$$$' && (rate < 60 || rate >= 100)) return false
        if (priceRange === '$$$$' && rate < 100) return false
      }
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
                <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                    {freelancerProfile?.avatar_url
                      ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                      : (freelancerProfile?.name || user.user_metadata?.full_name || user.email.split('@')[0]).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-gray-600 text-sm font-medium">
                    {freelancerProfile?.name || user.user_metadata?.full_name || user.email.split('@')[0]}
                  </span>
                </a>
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
                <a href="/dashboard" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                    {freelancerProfile?.avatar_url
                      ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                      : (freelancerProfile?.name || user.user_metadata?.full_name || user.email.split('@')[0]).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-gray-600 text-sm font-medium">
                    {freelancerProfile?.name || user.user_metadata?.full_name || user.email.split('@')[0]}
                  </span>
                </a>
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

      {/* Page header */}
      <div className="w-full py-8 px-4 sm:px-8" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Find a freelancer</h1>
          <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Browse trusted professionals across Barbados</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">

        {/* Search + filter card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-3">
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

            {/* Price range */}
            <select
              value={priceRange}
              onChange={e => setPriceRange(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-700 outline-none focus:border-gray-400 bg-white"
            >
              <option value="all">All prices</option>
              <option value="$">$ Budget (under $30)</option>
              <option value="$$">$$ Moderate ($30–$60)</option>
              <option value="$$$">$$$ Premium ($60–$100)</option>
              <option value="$$$$">$$$$ High end ($100+)</option>
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

        <p className="text-xs text-gray-400 mb-6">
          <span className="font-medium" style={{ color: '#00267F' }}>$</span> = Under $30&nbsp;&nbsp;·&nbsp;&nbsp;<span className="font-medium" style={{ color: '#00267F' }}>$$</span> = $30–$60&nbsp;&nbsp;·&nbsp;&nbsp;<span className="font-medium" style={{ color: '#00267F' }}>$$$</span> = $60–$100&nbsp;&nbsp;·&nbsp;&nbsp;<span className="font-medium" style={{ color: '#00267F' }}>$$$$</span> = $100+
        </p>

        {loading ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-sm">Loading freelancers...</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">{filtered.length} freelancer{filtered.length !== 1 ? 's' : ''} found</p>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 text-center py-20 px-8">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-700 mb-1">No freelancers match your search</p>
                <p className="text-sm text-gray-400 mb-6">Try a different keyword, or clear your filters to browse everyone.</p>
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium text-white px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Clear filters
                </button>
              </div>
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
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: f.available ? '#22c55e' : '#d1d5db' }}
                                title={f.available ? 'Available' : 'Unavailable'}
                              />
                            </div>
                            {/* Trade + location */}
                            <p className="text-sm font-medium mt-0.5" style={{ color: '#00267F' }}>
                              {f.trade}
                              {f.location && <span className="text-gray-400 font-normal"> · 📍 {f.location}</span>}
                            </p>
                          </div>

                          {/* Price indicator pill */}
                          {getPriceIndicator(f.hourly_rate) && (
                            <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border" style={{ color: '#00267F', borderColor: '#00267F' }}>
                              {getPriceIndicator(f.hourly_rate)}
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
                            <span className="text-xs text-gray-400">· Client rating: <span className="font-medium text-gray-600">{f.client_rating}</span></span>
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

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-8">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <p className="mt-1.5 text-xs">
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </p>
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
