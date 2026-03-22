'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function Home() {
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

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <span className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</span>
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
                {freelancerProfile && (
                  <a href="/inbox" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-gray-700 font-medium">
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
      <section className="px-4 sm:px-8 py-20 sm:py-28 text-center" style={{ background: 'linear-gradient(to bottom right, #00267F, #001a5c)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-5 leading-tight">
            Find trusted freelancers<br className="hidden sm:block" /> in Barbados
          </h1>
          <p className="text-lg sm:text-xl mb-10" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Every freelancer is reviewed by real clients. Every client is reviewed by freelancers.<br className="hidden sm:block" /> Real accountability, both ways.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              id="homeSearch"
              placeholder="What do you need? e.g. plumber, graphic designer..."
              className="flex-1 px-5 py-4 rounded-full text-gray-900 outline-none bg-white placeholder-gray-400 shadow-sm"
            />
            <button
              className="px-8 py-4 rounded-full font-semibold shadow-sm transition-colors"
              style={{ backgroundColor: '#F9C000', color: '#00267F' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E0AC00'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F9C000'}
              onClick={() => {
                const q = document.getElementById('homeSearch').value
                window.location.href = `/search?q=${q}`
              }}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trustSignals.map(s => (
            <div key={s.title} className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-3">
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
          {categories.map((cat) => (
            <a
              key={cat.name}
              href={`/search?q=${encodeURIComponent(cat.searchQuery)}`}
              className="flex flex-col items-center gap-3 px-4 py-6 bg-white border border-gray-100 rounded-2xl hover:shadow-sm cursor-pointer transition-all group"
              onMouseEnter={e => e.currentTarget.style.borderColor = '#00267F'}
              onMouseLeave={e => e.currentTarget.style.borderColor = ''}
            >
              <span className="text-4xl">{cat.icon}</span>
              <span className="font-medium text-gray-700 text-sm text-center leading-snug">{cat.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-t border-gray-100 py-16 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map(step => (
              <div key={step.n} className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                  {step.n}
                </div>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
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
