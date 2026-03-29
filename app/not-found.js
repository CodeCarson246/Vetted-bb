'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function NotFound() {
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
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="bg-white border-b border-gray-100">
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
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
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

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <p className="text-8xl font-bold" style={{ color: '#00267F' }}>404</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Oops, this page doesn't exist</h1>
          <p className="text-gray-500 mt-3">The page you're looking for may have been moved or doesn't exist.</p>
          <div className="flex gap-3 justify-center mt-8">
            <a
              href="/"
              className="px-6 py-2.5 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Go home
            </a>
            <a
              href="/search"
              className="px-6 py-2.5 rounded-full font-medium border-2 hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#00267F', color: '#00267F' }}
            >
              Find a freelancer
            </a>
          </div>
        </div>
      </div>
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
    </div>
  )
}
