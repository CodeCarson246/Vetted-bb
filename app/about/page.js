'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import TrustBar from '@/components/TrustBar'

export default function About() {
  const [user, setUser] = useState(null)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

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
                  className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
                <a href="/signup" className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Sign up</a>
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
                <a href="/dashboard" className="text-gray-700 font-medium">My dashboard</a>
                {freelancerProfile ? (
                  <a href="/inbox" className="text-gray-700 font-medium">Inbox</a>
                ) : user && (
                  <a href="/messages" className="text-gray-700 font-medium">My messages</a>
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
      <div className="w-full py-16 px-4 sm:px-8 text-center" style={{ background: 'linear-gradient(to bottom right, #00267F, #001a5c)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#F9C000' }}>Our story</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            Built for Barbados.<br />By people who live here.
          </h1>
          <p className="text-base sm:text-lg" style={{ color: '#93b8ff' }}>
            Vetted.bb exists because finding a reliable freelancer in Barbados shouldn't be a guessing game.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 flex flex-col gap-12">

        {/* The problem */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #00267F' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">The problem we set out to solve</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Anyone who has lived in Barbados knows the drill. You need a plumber, an electrician, a graphic designer, so you ask around. You get a WhatsApp number from a friend of a friend. You send a message and hope for the best.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Sometimes it works out. Sometimes you wait three weeks for a callback that never comes. There was no central place to find trusted local talent, read honest reviews, and make an informed decision. Until now.
          </p>
        </div>

      </div>

      {/* What makes us different */}
      <TrustBar />

      {/* Remaining content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 flex flex-col gap-12">

        {/* For freelancers */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #F9C000' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">For freelancers</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            If you are a skilled tradesperson, creative, or professional based in Barbados, Vetted.bb gives you a free professional profile where clients can find you, see your work, and reach out directly.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            No commission fees. No subscriptions. Just a place to showcase what you do and get discovered by people who need your skills.
          </p>
          <a
            href="/signup"
            className="inline-block text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#00267F' }}
          >
            Create your free profile →
          </a>
        </div>

        {/* For clients */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #00267F' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">For clients</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Search by trade, read reviews from real clients, and contact a freelancer directly. All in one place. Whether you need someone today or are planning ahead, Vetted.bb makes it easy to find the right person with confidence.
          </p>
          <a
            href="/search"
            className="inline-block font-semibold px-6 py-3 rounded-full hover:opacity-80 transition-opacity border-2"
            style={{ color: '#00267F', borderColor: '#00267F' }}
          >
            Browse freelancers →
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-4">
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
