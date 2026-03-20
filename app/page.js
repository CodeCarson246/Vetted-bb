'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const categories = [
  { icon: "🔧", name: "Plumbing" },
  { icon: "⚡", name: "Electrical" },
  { icon: "🎨", name: "Graphic Design" },
  { icon: "🏗️", name: "Construction" },
  { icon: "💻", name: "Web Development" },
  { icon: "🌿", name: "Landscaping" },
  { icon: "🚗", name: "Auto Repair" },
  { icon: "📸", name: "Photography" },
]

const trustSignals = [
  {
    icon: "✅",
    title: "Two-way reviews",
    desc: "Freelancers rate clients. Clients rate freelancers. Real accountability on both sides.",
  },
  {
    icon: "🪪",
    title: "Verified profiles",
    desc: "Every freelancer on Vetted.bb is a real person based in Barbados.",
  },
  {
    icon: "🇧🇧",
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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      if (u) {
        const { data: fp } = await supabase.from('freelancers').select('name, avatar_url').eq('user_id', u.id).single()
        setFreelancerProfile(fp || null)
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
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user.email}</a>
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
                  <a href="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium">{user.email}</a>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <a
              key={cat.name}
              href={`/search?q=${cat.name}`}
              className="flex flex-col items-center gap-3 p-7 bg-white border border-gray-100 rounded-2xl hover:shadow-sm cursor-pointer transition-all group"
              style={{ '--hover-border': '#00267F' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#00267F'}
              onMouseLeave={e => e.currentTarget.style.borderColor = ''}
            >
              <span className="text-4xl">{cat.icon}</span>
              <span className="font-medium text-gray-700 text-sm">{cat.name}</span>
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
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
