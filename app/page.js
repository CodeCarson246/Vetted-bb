'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'

const categories = [
  { icon: "🔧", name: "Trades & Construction", searchQuery: "electrician plumber carpenter mason painter roofer welder tiler construction builder" },
  { icon: "❄️", name: "AC & Solar", searchQuery: "ac air conditioning solar installer technician cooling heating" },
  { icon: "🌿", name: "Landscaping & Outdoors", searchQuery: "landscaper gardener pool cleaner pest control tree garden lawn irrigation" },
  { icon: "🚗", name: "Automotive", searchQuery: "mechanic auto car body repair detailer tow boat motorcycle vehicle engine" },
  { icon: "🧹", name: "Cleaning & Domestic", searchQuery: "cleaner cleaning housekeeper laundry maid domestic janitor ironing" },
  { icon: "💇", name: "Beauty & Wellness", searchQuery: "hairdresser barber nail makeup artist massage therapist personal trainer nutritionist beauty salon" },
  { icon: "🍽️", name: "Food & Catering", searchQuery: "chef caterer baker bartender food vendor cake catering meal prep cook" },
  { icon: "⚽", name: "Sports & Fitness", searchQuery: "football cricket swimming tennis gym trainer dance yoga coach instructor fitness" },
  { icon: "🎨", name: "Creative & Design", searchQuery: "graphic designer photographer videographer web designer social media content creator illustrator" },
  { icon: "💻", name: "Technology", searchQuery: "web developer app developer IT support computer repair network CCTV installer tech" },
  { icon: "🎉", name: "Events & Entertainment", searchQuery: "DJ event planner MC host decorator sound technician lighting band musician entertainment" },
  { icon: "📚", name: "Education & Tutoring", searchQuery: "tutor teacher maths english music driving language special needs education instructor" },
  { icon: "💼", name: "Business & Professional", searchQuery: "accountant bookkeeper lawyer notary HR consultant marketing translator business professional" },
  { icon: "❤️", name: "Health & Care", searchQuery: "nurse caregiver babysitter nanny elder care first aid health carer" },
  { icon: "✨", name: "Other", searchQuery: "other" },
]

const iconStyle = { width: '40px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }

const trustSignals = [
  {
    icon: <div style={iconStyle}>✅</div>,
    title: "Two-way reviews",
    desc: "Freelancers rate clients. Clients rate freelancers. Real accountability on both sides.",
  },
  {
    icon: <div style={iconStyle}>🪪</div>,
    title: "Verified profiles",
    desc: "Every freelancer on Vetted.bb is a real person based in Barbados.",
  },
  {
    icon: <img src="https://flagcdn.com/bb.svg" width="40" height="28" style={{ borderRadius: '4px' }} alt="Barbados flag" />,
    title: "Barbados based",
    desc: "Built specifically for the local community — not a generic global platform.",
  },
]

const steps = [
  { n: "1", title: "Search for a freelancer", desc: "Browse by trade, skill, or name. Filter by rating, price, and availability." },
  { n: "2", title: "Check their reviews", desc: "Read honest reviews from real clients — and see how they treat clients too." },
  { n: "3", title: "Hire with confidence", desc: "Reach out knowing exactly who you're working with before you commit." },
]

// Toggle: set NEXT_PUBLIC_SHOW_STATS_NUMBERS=true in .env.local to switch from
// the qualitative trust bar to the live-count stats row (use when 50+ providers & 100+ reviews).
const SHOW_STATS_NUMBERS = process.env.NEXT_PUBLIC_SHOW_STATS_NUMBERS === 'true'

export default function Home() {
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [freelancerCount, setFreelancerCount] = useState(null)
  const [reviewCount, setReviewCount] = useState(null)
  const [featuredReviews, setFeaturedReviews] = useState([])
  const [featuredFreelancers, setFeaturedFreelancers] = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})

  // Lightweight fetch: just enough to compute per-category provider counts
  // for the subtle "Coming soon" badge on empty category tiles.
  useEffect(() => {
    supabase.from('freelancers').select('name, trade, skills').then(({ data }) => {
      if (!data) return
      const counts = {}
      for (const cat of categories) {
        const words = cat.searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
        counts[cat.name] = data.filter(f => {
          const haystack = [f.name, f.trade, ...(f.skills || [])].join(' ').toLowerCase()
          return words.some(w => haystack.includes(w))
        }).length
      }
      setCategoryCounts(counts)
    })
  }, [])

  // Featured professionals — fetched from the ISR-cached API route
  useEffect(() => {
    fetch('/api/featured-professionals')
      .then(r => r.json())
      .then(({ data }) => setFeaturedFreelancers(data || []))
  }, [])

  useEffect(() => {
    const reviewsQuery = supabase.from('reviews').select('comment, rating, author, date').eq('type', 'client').gte('rating', 5).not('comment', 'is', null).limit(3).order('date', { ascending: false })
    if (SHOW_STATS_NUMBERS) {
      Promise.all([
        supabase.from('freelancers').select('*', { count: 'exact', head: true }).eq('available', true),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('type', 'client'),
        reviewsQuery,
      ]).then(([{ count: fc }, { count: rc }, { data: revs }]) => {
        setFreelancerCount(fc || 0)
        setReviewCount(rc || 0)
        setFeaturedReviews(revs || [])
      })
    } else {
      reviewsQuery.then(({ data: revs }) => {
        setFeaturedReviews(revs || [])
      })
    }
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

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-6">
            <a href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</a>
            <a href="/search" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <span className="hidden sm:inline">Browse Professionals</span>
              <span className="sm:hidden">Browse</span>
            </a>
          </div>
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
                {freelancerProfile ? (
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
                ) : user && (
                  <a href="/messages" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors" title="My messages">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                  className="text-white px-5 py-2 rounded-full font-medium transition-opacity hover:opacity-90"
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
                  className="text-white px-5 py-2 rounded-full font-medium transition-opacity hover:opacity-90"
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
                  <a href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" onClick={() => setMenuOpen(false)} className="text-gray-600 text-sm font-medium">{user?.user_metadata?.full_name || user?.email}</a>
                )}
                {freelancerProfile ? (
                  <a href="/inbox" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-gray-700 font-medium">
                    Inbox
                    {unreadCount > 0 && (
                      <span className="min-w-[18px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                ) : user && (
                  <a href="/messages" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">My messages</a>
                )}
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-left text-red-500 font-medium">Log out</button>
              </>
            ) : (
              <>
                <a href="/search" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">Browse freelancers</a>
                <a href="/signup" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">List your services</a>
                <a href="/login" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">Log in</a>
                <a href="/signup" onClick={() => setMenuOpen(false)} className="font-medium" style={{ color: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="px-4 sm:px-8 py-20 sm:py-32 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 60%, #001240 100%)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #F9C000 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 40%)' }} />
        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ backgroundColor: 'rgba(249,192,0,0.15)', color: '#F9C000', border: '1px solid rgba(249,192,0,0.3)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F9C000', display: 'inline-block' }} />
            🇧🇧 Barbados&apos; #1 professional marketplace
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            Stop guessing.<br className="hidden sm:block" />
            Find verified professionals<span style={{ color: '#F9C000' }}> in Barbados</span>
          </h1>
          <p className="text-lg sm:text-xl mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Real reviews. Verified identities. Send a quote request in minutes — no more chasing WhatsApp numbers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              id="homeSearch"
              placeholder="Try: plumber, electrician, wedding photographer..."
              className="flex-1 px-6 py-4 rounded-full text-gray-900 outline-none bg-white placeholder-gray-400 text-base"
              style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const q = document.getElementById('homeSearch').value
                  window.location.href = `/search?q=${q}`
                }
              }}
            />
            <button
              className="px-8 py-4 rounded-full font-bold text-base transition-all"
              style={{ backgroundColor: '#F9C000', color: '#00267F', boxShadow: '0 4px 16px rgba(249,192,0,0.35)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E0AC00'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F9C000'; e.currentTarget.style.transform = 'translateY(0)' }}
              onClick={() => {
                const q = document.getElementById('homeSearch').value
                window.location.href = `/search?q=${q}`
              }}
            >
              Search
            </button>
          </div>
          <p className="text-xs mt-5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Free to use · No account needed to browse · 100% Barbados-based professionals
          </p>
        </div>
      </section>

      {/* Trust signals */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trustSignals.map(s => (
            <div key={s.title} className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-sm transition-shadow" style={{ borderTop: '3px solid #00267F' }}>
              <span className="text-3xl">{s.icon}</span>
              <h3 className="font-semibold text-gray-900">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse by category */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 category-grid">
          {categories.map((cat) => {
            const isEmpty = categoryCounts[cat.name] === 0
            return (
              <a
                key={cat.name}
                href={`/search?q=${encodeURIComponent(cat.searchQuery)}&category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-3 px-4 py-6 bg-white border border-gray-100 rounded-2xl hover:shadow-sm cursor-pointer transition-all group"
                onMouseEnter={e => e.currentTarget.style.borderColor = '#00267F'}
                onMouseLeave={e => e.currentTarget.style.borderColor = ''}
              >
                <span className="text-4xl">{cat.icon}</span>
                <span className="font-medium text-gray-700 text-sm text-center leading-snug">{cat.name}</span>
                {isEmpty && (
                  <span className="text-xs text-gray-400 font-normal -mt-1">Coming soon</span>
                )}
              </a>
            )
          })}
        </div>
      </section>

      {/* Top-Rated Professionals */}
      {featuredFreelancers.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-8 pb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Top-Rated Professionals This Week</h2>
            <p className="text-sm text-gray-500 mt-2">Real people. Real reviews. Ready to hire.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {featuredFreelancers.map(f => (
              <a
                key={f.id}
                href={`/freelancers/${f.id}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all hover:shadow-lg"
                style={{ borderTop: '3px solid #00267F' }}
              >
                <div className="p-6">
                  {/* Avatar + identity */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {f.avatar_url
                        ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                        : f.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-bold text-gray-900 leading-tight truncate">{f.name}</p>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <span className={`w-2 h-2 rounded-full ${f.available ? 'bg-green-400' : 'bg-gray-300'}`} />
                          <span className={`text-xs ${f.available ? 'text-green-600' : 'text-gray-400'}`}>
                            {f.available ? 'Available' : 'Unavailable'}
                          </span>
                        </span>
                      </div>
                      <p className="text-sm font-semibold capitalize" style={{ color: '#F9C000' }}>{f.trade}</p>
                      {f.location && <p className="text-xs text-gray-400 mt-0.5">📍 {f.location}</p>}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className="text-sm" style={{ color: s <= Math.round(f.rating) ? '#F9C000' : '#e5e7eb' }}>★</span>
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{f.rating}</span>
                    <span className="text-xs text-gray-400">({f.review_count} {f.review_count === 1 ? 'review' : 'reviews'})</span>
                  </div>

                  {/* Verified badge */}
                  {f.verified && (
                    <div className="flex items-center gap-1.5 mb-4">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(249,192,0,0.2)" stroke="#F9C000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 12l2 2 4-4" stroke="#F9C000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-semibold" style={{ color: '#00267F' }}>Verified</span>
                    </div>
                  )}

                  {/* Skill tags */}
                  {f.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {f.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>{skill}</span>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold transition-opacity group-hover:opacity-90" style={{ backgroundColor: '#00267F', color: 'white' }}>
                    View Profile
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="text-center mt-8">
            <a href="/search" className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: '#00267F' }}>
              Browse all professionals →
            </a>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-white border-t border-gray-100 py-16 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map(step => (
              <div key={step.n} className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                  {step.n}
                </div>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Provider recruitment */}
      <section className="px-4 sm:px-8 py-16 sm:py-20" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-12 sm:gap-16">

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#F9C000' }}>
                For Professionals
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-4">
                Get found by clients who are already looking for you
              </h2>
              <p className="text-sm sm:text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Join Barbados&apos; only professional marketplace with real reviews and verified profiles. Set up your free profile in under 10 minutes.
              </p>

              <ul className="flex flex-col gap-3 mb-8">
                {[
                  'Free to join — no commission on your jobs',
                  'Clients can send you quote requests directly through the platform',
                  'Build your reputation with verified reviews',
                ].map(benefit => (
                  <li key={benefit} className="flex items-start gap-3">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                      <circle cx="9" cy="9" r="9" fill="rgba(249,192,0,0.2)" />
                      <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#F9C000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{benefit}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/signup"
                className="inline-block px-7 py-3.5 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#F9C000', color: '#00267F' }}
              >
                Create Your Free Profile
              </a>
              <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Already listed? Share your profile link and start getting inquiries.
              </p>
            </div>

            {/* Illustration */}
            <div className="flex-shrink-0 flex items-center justify-center w-full sm:w-64">
              <div className="relative w-56 h-56 flex items-center justify-center">
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(249,192,0,0.08)', border: '1px solid rgba(249,192,0,0.15)' }} />
                {/* Inner content */}
                <div className="relative flex flex-col items-center gap-3">
                  {/* Top row: two profile blobs */}
                  <div className="flex gap-3">
                    {[['🔧','Plumber'],['💇','Stylist']].map(([icon, label]) => (
                      <div key={label} className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <span className="text-2xl">{icon}</span>
                        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color: '#F9C000' }}>★ 4.9</span>
                      </div>
                    ))}
                  </div>
                  {/* Bottom centre: third card */}
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span className="text-2xl">💻</span>
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Developer</span>
                    <span className="text-xs font-semibold" style={{ color: '#F9C000' }}>★ 5.0</span>
                  </div>
                  {/* Verified badge floating */}
                  <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#00267F" strokeWidth="0"/>
                      <path d="M9 12l2 2 4-4" stroke="#F9C000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Verified
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 px-4 sm:px-8" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
        <div className="max-w-5xl mx-auto">

          {SHOW_STATS_NUMBERS ? (
            /* Live stats row — enabled when NEXT_PUBLIC_SHOW_STATS_NUMBERS=true */
            (freelancerCount > 0 || reviewCount > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-14">
                <div className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold text-white">{freelancerCount}+</p>
                  <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Freelancers available</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold text-white">{reviewCount}+</p>
                  <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Verified reviews</p>
                </div>
                <div className="col-span-2 sm:col-span-1 text-center">
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: '#F9C000' }}>100%</p>
                  <p className="text-sm mt-1" style={{ color: '#93b8ff' }}>Barbados based</p>
                </div>
              </div>
            )
          ) : (
            /* Qualitative trust bar — default until platform has scale */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-14">
              <div className="flex flex-col items-center text-center gap-3">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F9C000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="rgba(249,192,0,0.15)"/>
                </svg>
                <p className="text-white font-medium leading-snug text-sm sm:text-base">Every profile manually verified before going live</p>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F9C000"/>
                </svg>
                <p className="text-white font-medium leading-snug text-sm sm:text-base">Two-way reviews — freelancers and clients both rated</p>
              </div>
              <div className="flex flex-col items-center text-center gap-3">
                <img src="https://flagcdn.com/bb.svg" width="56" height="40" style={{ borderRadius: '4px', border: '1px solid rgba(255,255,255,0.25)' }} alt="Barbados flag" />
                <p className="text-white font-medium leading-snug text-sm sm:text-base">Built exclusively for Barbados</p>
              </div>
            </div>
          )}

          {/* Review quotes */}
          {featuredReviews.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredReviews.map((rev, i) => (
                <div key={i} className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className="text-sm" style={{ color: '#F9C000' }}>★</span>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    &ldquo;{rev.comment.length > 120 ? rev.comment.slice(0, 120) + '…' : rev.comment}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 mt-auto">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(249,192,0,0.2)', color: '#F9C000' }}>
                      {formatDisplayName(rev.author)[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{formatDisplayName(rev.author)}</p>
                      <p className="text-xs" style={{ color: '#93b8ff' }}>{rev.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs">
          <a href="/search" className="hover:text-gray-600 transition-colors">Browse freelancers</a>
          <a href="/signup" className="hover:text-gray-600 transition-colors">List your services</a>
          <a href="/about" className="hover:text-gray-600 transition-colors">About</a>
          <a href="/faq" className="hover:text-gray-600 transition-colors">FAQ</a>
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </div>
      </footer>
    </main>
  )
}
