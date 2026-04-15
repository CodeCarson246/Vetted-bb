'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDisplayName } from '@/lib/formatDisplayName'
import TrustBar from '@/components/TrustBar'

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
    desc: "Built specifically for the local community, not a generic global platform.",
  },
]

const steps = [
  { n: "1", icon: "🔍", title: "Search your trade", desc: "Type what you need — plumber, photographer, tutor — and filter by location or category. See real profiles with real reviews." },
  { n: "2", icon: "💬", title: "Send a quote request", desc: "Pick services from a freelancer's portfolio, add them to your estimate cart, and send a formal quote request — all in-app." },
  { n: "3", icon: "⭐", title: "Get it done & review", desc: "Work with your professional, then leave an honest review. Your feedback helps the whole Barbados community." },
]

// Toggle: set NEXT_PUBLIC_SHOW_STATS_NUMBERS=true in .env.local to switch from
// the qualitative trust bar to the live-count stats row (use when 50+ providers & 100+ reviews).
const SHOW_STATS_NUMBERS = process.env.NEXT_PUBLIC_SHOW_STATS_NUMBERS === 'true'

function getAvatarGradient(name) {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    'linear-gradient(135deg, #0099f7 0%, #00267F 100%)',
  ]
  const hash = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

export default function Home() {
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
      .then(({ data, error }) => {
        console.log('[Featured Professionals] data:', data, '| error:', error, '| count:', data?.length ?? 0)
        setFeaturedFreelancers(data || [])
      })
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
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="px-4 sm:px-8 pt-20 sm:pt-32 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 60%, #001240 100%)', paddingBottom: '120px' }}>
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
            Real reviews. Verified identities. Send a quote request in minutes. No more chasing WhatsApp numbers.
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

        {/* Wave divider — fill matches TrustBar navy (#00267F) */}
        <div style={{ position: 'absolute', bottom: '-1px', left: 0, width: '100%', lineHeight: 0, overflow: 'hidden' }}>
          <svg
            viewBox="0 0 1440 60"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: '60px' }}
          >
            <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="#00267F" />
          </svg>
        </div>
      </section>

      {/* Trust bar */}
      <TrustBar />

      {/* Featured Professionals */}
      {featuredFreelancers.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-16" style={{ paddingTop: '80px' }}>
          <div className="mb-10">
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#d9a800', marginBottom: '8px' }}>
              TOP RATED
            </p>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.8px', color: '#00267F', marginBottom: '8px', lineHeight: 1.15 }}>
              Featured Professionals
            </h2>
            <p style={{ color: '#6B7280', fontSize: '1rem', fontFamily: "'Inter', sans-serif" }}>
              Real people. Real reviews. Ready to hire.
            </p>
          </div>

          {/* Desktop: 3-column grid | Mobile: horizontal scroll carousel */}
          <div
            className="no-scrollbar hidden-scroll-mobile"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
            }}
          >
            <style>{`
              @media (max-width: 767px) {
                .hidden-scroll-mobile {
                  display: flex !important;
                  overflow-x: auto;
                  scroll-snap-type: x mandatory;
                  padding: 0 24px;
                  padding-right: 48px;
                  gap: 16px;
                }
                .hidden-scroll-mobile > a {
                  min-width: 85vw;
                  flex-shrink: 0;
                  scroll-snap-align: start;
                }
              }
            `}</style>
            {featuredFreelancers.map(f => (
              <a
                key={f.id}
                href={`/freelancers/${f.id}`}
                style={{
                  backgroundColor: 'white',
                  borderTop: '4px solid #00267F',
                  borderRadius: '16px',
                  padding: '28px 24px 24px',
                  boxShadow: 'var(--card-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)' }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    background: f.avatar_url ? undefined : getAvatarGradient(f.name),
                    backgroundColor: f.avatar_url ? undefined : 'transparent',
                  }}>
                    {f.avatar_url
                      ? <img src={f.avatar_url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#00267F', lineHeight: 1.2 }}>{f.name}</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '2px', textTransform: 'capitalize' }}>{f.trade}</p>
                  </div>
                </div>

                {/* Star rating */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
                  {f.review_count > 0 ? (
                    <>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ fontSize: '0.85rem', color: s <= Math.round(f.rating) ? '#F9C000' : '#e5e7eb' }}>★</span>
                        ))}
                      </div>
                      <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.85rem', color: '#00267F' }}>{f.rating}</span>
                      <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>({f.review_count} {f.review_count === 1 ? 'review' : 'reviews'})</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>No reviews yet</span>
                  )}
                </div>

                {/* Bio */}
                {f.bio && (
                  <p style={{
                    fontSize: '0.85rem',
                    color: '#6B7280',
                    lineHeight: 1.6,
                    marginBottom: '12px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {f.bio}
                  </p>
                )}

                {/* Skill tags */}
                {f.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {f.skills.slice(0, 3).map(skill => (
                      <span key={skill} style={{
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        color: '#00267F',
                        backgroundColor: 'rgba(0,38,127,0.06)',
                        padding: '3px 10px',
                        borderRadius: '999px',
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(0,38,127,0.07)',
                  paddingTop: '16px',
                  marginTop: 'auto',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: f.available ? '#22c55e' : '#f97316', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: f.available ? '#16a34a' : '#ea580c' }}>
                        {f.available ? 'Available now' : 'Busy this week'}
                      </span>
                    </div>
                    {f.min_price != null && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        From ${Number.isInteger(f.min_price) ? f.min_price : parseFloat(f.min_price).toFixed(0)}
                      </span>
                    )}
                  </div>
                  <span style={{
                    backgroundColor: '#00267F',
                    color: 'white',
                    fontSize: '0.8rem',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                  }}>
                    View Profile
                  </span>
                </div>
              </a>
            ))}
          </div>

          {/* Scroll hint dots — mobile only */}
          <div className="flex justify-center items-center gap-2 mt-5 md:hidden">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00267F', display: 'inline-block' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'rgba(0,38,127,0.2)', display: 'inline-block' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'rgba(0,38,127,0.2)', display: 'inline-block' }} />
          </div>

          <div className="text-center mt-10">
            <a
              href="/search"
              style={{
                backgroundColor: '#00267F',
                color: 'white',
                padding: '14px 36px',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                fontFamily: "'Sora', sans-serif",
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Browse all professionals →
            </a>
          </div>
        </section>
      )}

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

      {/* How it works */}
      <section id="how-it-works" style={{ backgroundColor: '#00267F' }} className="py-16 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="mb-14">
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#F9C000', marginBottom: '10px' }}>
              SIMPLE PROCESS
            </p>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '2.2rem', color: 'white', marginBottom: '12px', lineHeight: 1.15 }}>
              Get it done in three steps
            </h2>
            <p style={{ color: '#93b8ff', fontSize: '1rem', fontFamily: "'Inter', sans-serif" }}>
              From search to quote in minutes — no back-and-forth, no hassle.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {steps.map(step => (
              <div
                key={step.n}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '32px 28px',
                }}
              >
                {/* Step number badge */}
                <div style={{
                  width: 44,
                  height: 44,
                  backgroundColor: '#F9C000',
                  color: '#00267F',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  marginBottom: '16px',
                  flexShrink: 0,
                }}>
                  {step.n}
                </div>
                {/* Icon */}
                <div style={{ fontSize: '1.8rem', marginBottom: '14px' }}>{step.icon}</div>
                <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: 'white', marginBottom: '10px' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
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
                  'Free to join. No commission on your jobs.',
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
                href="/signup?role=freelancer"
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

          {/* Live stats row — enabled when NEXT_PUBLIC_SHOW_STATS_NUMBERS=true */}
          {SHOW_STATS_NUMBERS && (freelancerCount > 0 || reviewCount > 0) && (
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

    </main>
  )
}
