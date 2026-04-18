'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SearchEmptyState from '@/components/SearchEmptyState'
import Tooltip from '@/components/Tooltip'

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #00267F, #1a3f9e)',
  'linear-gradient(135deg, #7e22ce, #a855f7)',
  'linear-gradient(135deg, #065f46, #059669)',
  'linear-gradient(135deg, #92400e, #d97706)',
  'linear-gradient(135deg, #1e3a5f, #2563eb)',
  'linear-gradient(135deg, #831843, #db2777)',
]

function getAvatarGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0]
  return AVATAR_GRADIENTS[name.charCodeAt(0) % 6]
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <span key={star} className={star <= Math.round(rating) ? 'text-yellow-400 text-sm' : 'text-gray-200 text-sm'}>★</span>
      ))}
    </div>
  )
}

function getSortedServices(services, sortOrder) {
  if (!services || services.length === 0) return []
  const sorted = [...services].sort((a, b) => parseInt(a.price, 10) - parseInt(b.price, 10))
  return sortOrder === 'price_high' ? sorted.reverse() : sorted
}

function FreelancerCard({ f, getMinPrice, sortBy }) {
  const displayServices = getSortedServices(f.services, sortBy).slice(0, 5)
  const minPrice = getMinPrice(f)
  const hasServices = displayServices.length > 0
  const initials = f.name ? f.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'

  return (
    <a
      href={`/freelancers/${f.id}`}
      className="block"
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        borderTop: '4px solid #00267F',
        border: '1px solid rgba(0,38,127,0.08)',
        borderTopWidth: 4,
        borderTopColor: '#00267F',
        boxShadow: '0 2px 12px rgba(0,38,127,0.08)',
        marginBottom: 16,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,38,127,0.15)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,38,127,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Card body: flex row on desktop, column on mobile */}
      <div className="flex flex-col md:flex-row">

        {/* LEFT SECTION */}
        <div className="flex gap-4 items-start flex-1 min-w-0" style={{ padding: 24 }}>

          {/* Avatar */}
          <div
            className="flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: f.avatar_url ? undefined : getAvatarGradient(f.name),
            }}
          >
            {f.avatar_url
              ? <img src={f.avatar_url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
              : <span style={{ color: '#fff', fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem' }}>{initials}</span>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name row */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, color: '#00267F', fontSize: '1rem', lineHeight: 1.3, margin: 0, textTransform: 'capitalize' }}>
                {f.name}
              </h3>
              {/* Vetted badge */}
              {f.verified && (
                <span style={{
                  background: 'rgba(0,38,127,0.08)',
                  color: '#00267F',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '2px 8px',
                  borderRadius: 999,
                  lineHeight: 1.6,
                }}>✓ Vetted</span>
              )}
              {/* Availability dot */}
              <span className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${f.available ? 'bg-green-400' : 'bg-gray-300'}`} />
                <span className={`text-xs font-medium ${f.available ? 'text-green-600' : 'text-gray-400'}`}>
                  {f.available ? 'Available' : 'Unavailable'}
                </span>
              </span>
            </div>

            {/* Company */}
            {f.company_name && f.company_name.trim().length > 3 && (
              <p style={{ color: '#6B7280', fontSize: '0.85rem', margin: '2px 0 0' }}>{f.company_name}</p>
            )}

            {/* Trade + location */}
            <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' }}>
              {f.trade}
              {f.location && (
                <span style={{ fontWeight: 400, fontSize: '0.82rem' }}> · 📍 {f.location}</span>
              )}
            </p>

            {/* Rating row */}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <StarRating rating={f.rating} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F2937', marginLeft: 2 }}>{f.rating}</span>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>({f.review_count})</span>
              </div>
              {f.client_rating > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                  · Client rep: <span style={{ fontWeight: 600, color: '#6B7280' }}>{f.client_rating}</span>
                  <Tooltip text="How freelancers rate this client to work with">
                    <svg className="w-3 h-3 cursor-help text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </Tooltip>
                </span>
              )}
            </div>

            {/* Skill tags */}
            {f.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {f.skills.slice(0, 3).map(skill => (
                  <span key={skill} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 999, fontWeight: 500, background: '#EEF2FF', color: '#00267F' }}>{skill}</span>
                ))}
                {f.skills.length > 3 && (
                  <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 999, fontWeight: 500, background: '#F3F4F6', color: '#6B7280' }}>+{f.skills.length - 3}</span>
                )}
              </div>
            )}

            {/* From $X price indicator (below tags) */}
            {minPrice !== null && (
              <>
                <div style={{ height: 1, background: 'rgba(0,38,127,0.08)', margin: '12px 0 8px' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#00267F', margin: 0 }}>From ${minPrice}</p>
              </>
            )}
          </div>
        </div>

        {/* DIVIDER — vertical on desktop */}
        {hasServices && (
          <>
            <div className="hidden md:block flex-shrink-0" style={{ width: 1, background: 'rgba(0,38,127,0.1)', margin: '16px 0' }} />
            <div className="md:hidden" style={{ height: 1, background: 'rgba(0,38,127,0.1)', margin: '0 24px' }} />
          </>
        )}

        {/* RIGHT SECTION — services */}
        {hasServices && (
          <div
            className="flex-shrink-0"
            style={{
              background: 'rgba(0,38,127,0.02)',
              borderRadius: '0 12px 12px 0',
              padding: '20px 20px 20px 16px',
              minWidth: 200,
              maxWidth: 240,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Services</span>
              <Tooltip content={
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Price guide</span>
                  <span style={{ display: 'block' }}><span style={{ color: '#93b8ff' }}>■</span> Navy — fixed rate</span>
                  <span style={{ display: 'block' }}><span style={{ color: '#F59E0B' }}>■</span> Orange — starting from <span style={{ color: '#c0c8d8' }}>(may vary)</span></span>
                </span>
              }>
                <span style={{ fontSize: 13, color: '#9CA3AF', cursor: 'help', marginLeft: 4, lineHeight: 1 }}>ⓘ</span>
              </Tooltip>
            </div>
            {displayServices.map((svc, i) => (
              <div key={svc.id} style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1.8, marginTop: i > 0 ? 4 : 0 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#00267F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{svc.name}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: svc.price_type === 'starting_from' ? '#F59E0B' : '#00267F', flexShrink: 0, marginLeft: 6 }}>
                  · ${Number.isInteger(svc.price) ? svc.price : parseFloat(svc.price).toFixed(0)}{svc.price_type === 'starting_from' ? '+' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Services — mobile stacked */}
        {hasServices && (
          <div className="md:hidden flex flex-wrap gap-x-4 gap-y-1" style={{ padding: '12px 24px 20px' }}>
            {displayServices.map(svc => (
              <span key={svc.id} style={{ fontSize: '0.78rem' }}>
                <span style={{ fontWeight: 500, color: '#00267F' }}>{svc.name}</span>
                <span style={{ fontWeight: 700, color: svc.price_type === 'starting_from' ? '#F59E0B' : '#00267F' }}>{' · $'}{Number.isInteger(svc.price) ? svc.price : parseFloat(svc.price).toFixed(0)}{svc.price_type === 'starting_from' ? '+' : ''}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
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

  const [sortBy, setSortBy] = useState('rating')
  const [availability, setAvailability] = useState('all')
  const [budget, setBudget] = useState('all')
  const [location, setLocation] = useState('')
  const PARISHES = ['Christ Church','Saint Andrew','Saint George','Saint James','Saint John','Saint Joseph','Saint Lucy','Saint Michael','Saint Peter','Saint Philip','Saint Thomas']

  useEffect(() => {
    async function fetchFreelancers() {
      setLoading(true)
      let q = supabase.from('freelancers').select('*, services(id, name, price, price_type)')
      if (availability === 'available') q = q.eq('available', true)
      if (location) q = q.eq('location', location)
      const { data } = await q
      setFreelancers(data || [])
      setLoading(false)
    }
    fetchFreelancers()
  }, [availability, location])

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

  const getMinPrice = (f) => {
    if (!f.services || f.services.length === 0) return null
    return Math.min(...f.services.map(s => parseInt(s.price, 10)))
  }

  const getMaxPrice = (f) => {
    if (!f.services || f.services.length === 0) return null
    return Math.max(...f.services.map(s => parseInt(s.price, 10)))
  }

  const filtered = freelancers
    .filter(f => {
      if (query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean)
        const haystack = [f.name, f.trade, f.category || '', ...(f.skills || [])].join(' ').toLowerCase()
        if (!words.some(w => haystack.includes(w))) return false
      }
      if (budget !== 'all') {
        const p = getMinPrice(f)
        if (p === null) return false
        if (budget === 'u100'  && p >= 100)  return false
        if (budget === 'u250'  && p >= 250)  return false
        if (budget === 'u500'  && p >= 500)  return false
        if (budget === 'u1000' && p >= 1000) return false
        if (budget === 'o1000' && p < 1000)  return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        const rA = a.rating || 0
        const rB = b.rating || 0
        if (rB !== rA) return rB - rA
        return (b.review_count || 0) - (a.review_count || 0)
      }
      if (sortBy === 'reviews') return (b.review_count || 0) - (a.review_count || 0)
      if (sortBy === 'price_low') {
        const pA = getMinPrice(a), pB = getMinPrice(b)
        if (pA === null && pB === null) return 0
        if (pA === null) return 1
        if (pB === null) return -1
        return pA - pB
      }
      if (sortBy === 'price_high') {
        const pA = getMaxPrice(a), pB = getMaxPrice(b)
        if (pA === null && pB === null) return 0
        if (pA === null) return 1
        if (pB === null) return -1
        return pB - pA
      }
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAvailability('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${availability === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={availability === 'all' ? { backgroundColor: '#00267F' } : {}}
              >All</button>
              <button
                onClick={() => setAvailability('available')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${availability === 'available' ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                style={availability === 'available' ? { backgroundColor: '#00267F' } : {}}
              >Available only</button>
            </div>

            <div className="w-px h-4 bg-gray-200 hidden sm:block" />

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

            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-700 outline-none focus:border-gray-400 bg-white"
            >
              <option value="">All locations</option>
              {PARISHES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {(activeFilterCount > 0 || query) && (
              <div className="flex items-center gap-2 ml-auto">
                {activeFilterCount > 0 && (
                  <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: '#00267F' }}>
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                  </span>
                )}
                <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors">
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl animate-pulse overflow-hidden" style={{ borderTop: '4px solid #e5e7eb', border: '1px solid rgba(0,38,127,0.06)', boxShadow: '0 2px 12px rgba(0,38,127,0.05)' }}>
                <div className="flex gap-5 items-start p-6">
                  <div className="w-14 h-14 flex-shrink-0 bg-gray-200" style={{ borderRadius: 14 }} />
                  <div className="flex-1 min-w-0">
                    <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, j) => <div key={j} className="w-3.5 h-3.5 bg-gray-200 rounded" />)}
                      <div className="w-8 h-3.5 bg-gray-200 rounded ml-1" />
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <div className="h-6 bg-gray-200 rounded-full w-16" />
                      <div className="h-6 bg-gray-200 rounded-full w-20" />
                      <div className="h-6 bg-gray-200 rounded-full w-14" />
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
              <SearchEmptyState query={query} category={category} onClearFilters={clearFilters} />
            ) : (
              /* List container */
              <div style={{ background: '#F8F9FB', padding: '24px 0', borderRadius: 12 }}>
                {filtered.map(f => (
                  <FreelancerCard key={f.id} f={f} getMinPrice={getMinPrice} sortBy={sortBy} />
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
