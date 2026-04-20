'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function SiteNav() {
  const { user } = useAuth()
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      setFreelancerProfile(null)
      setUnreadCount(0)
      return
    }
    supabase
      .from('freelancers')
      .select('id, name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: fp }) => {
        setFreelancerProfile(fp || null)
        if (fp) {
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', fp.id)
            .eq('read', false)
            .then(({ count }) => setUnreadCount(count || 0))
        }
      })
  }, [user])

  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const isSearchPage = pathname === '/search'

  // Initials fallback for avatar
  const initials = freelancerProfile?.name
    ? freelancerProfile.name.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2)
    : (user?.user_metadata?.full_name || user?.email || '?')[0].toUpperCase()

  const avatarUrl = freelancerProfile?.avatar_url || null
  const profileId = freelancerProfile?.id || null

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid rgba(0,38,127,0.08)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 24px',
      }}>

        {/* Logo */}
        <a href="/" style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: '1.4rem',
          letterSpacing: '-0.5px',
          textDecoration: 'none',
          lineHeight: 1,
          flexShrink: 0,
        }}>
          <span style={{ color: '#00267F' }}>Vetted</span>
          <span style={{ color: '#F9C000' }}>.</span>
          <span style={{ color: '#00267F' }}>bb</span>
        </a>

        {/* Centre search bar — hidden on /search, hidden under md (768px) */}
        {!isSearchPage && (
          <form
            onSubmit={handleSearchSubmit}
            style={{
              flex: '1 1 auto',
              maxWidth: '340px',
              position: 'relative',
              alignItems: 'center',
              display: 'none',
            }}
            className="md-search-bar"
          >
            <button
              type="submit"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'rgba(0,38,127,0.35)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <input
              type="text"
              placeholder="Search professionals..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                borderRadius: '999px',
                border: '1px solid rgba(0,38,127,0.2)',
                backgroundColor: 'white',
                paddingLeft: '36px',
                paddingRight: '14px',
                fontSize: '0.875rem',
                color: '#374151',
                outline: 'none',
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={e => (e.currentTarget.style.border = '1px solid rgba(0,38,127,0.45)')}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(0,38,127,0.2)')}
            />
          </form>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Desktop nav — hidden on mobile */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
          className="desktop-nav"
        >
          {/* Browse Professionals link */}
          <a
            href="/search"
            style={{
              color: '#00267F',
              fontSize: '0.9rem',
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Browse Professionals
          </a>

          {user ? (
            <>
              {/* Quotes icon — coming soon */}
              <a
                href="/quotes"
                title="Quotes — coming soon"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px',
                  color: '#6B7280',
                  opacity: 0.45,
                  textDecoration: 'none',
                  cursor: 'default',
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>

              {/* Inbox icon */}
              <a
                href={freelancerProfile ? '/inbox' : '/messages'}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px',
                  color: '#6B7280',
                  textDecoration: 'none',
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    backgroundColor: '#ef4444',
                    color: 'white',
                    fontSize: '0.65rem',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>

              {/* Avatar + dropdown */}
              <div ref={dropdownRef} style={{ position: 'relative', marginLeft: '4px' }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#00267F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    overflow: 'hidden',
                    flexShrink: 0,
                    outline: dropdownOpen ? '2px solid rgba(0,38,127,0.3)' : 'none',
                    outlineOffset: '2px',
                  }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials}
                  </div>
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(0,38,127,0.12)',
                    border: '1px solid rgba(0,38,127,0.15)',
                    minWidth: '190px',
                    zIndex: 300,
                    overflow: 'hidden',
                    padding: '4px 0',
                  }}>
                    <a
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      style={{ display: 'block', padding: '10px 16px', fontSize: '0.875rem', fontFamily: "'Inter', sans-serif", color: '#374151', textDecoration: 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F0F4FF'; e.currentTarget.style.color = '#00267F' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151' }}
                    >
                      Dashboard
                    </a>
                    {profileId && (
                      <a
                        href={`/freelancers/${profileId}`}
                        onClick={() => setDropdownOpen(false)}
                        style={{ display: 'block', padding: '10px 16px', fontSize: '0.875rem', fontFamily: "'Inter', sans-serif", color: '#374151', textDecoration: 'none' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F0F4FF'; e.currentTarget.style.color = '#00267F' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#374151' }}
                      >
                        View my profile
                      </a>
                    )}
                    <div style={{ borderTop: '1px solid rgba(0,38,127,0.08)', margin: '4px 0' }} />
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        supabase.auth.signOut().then(() => { window.location.href = '/login' })
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        fontSize: '0.875rem',
                        fontFamily: "'Inter', sans-serif",
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <a
                href="/login"
                style={{
                  color: '#00267F',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: '1.5px solid #00267F',
                  backgroundColor: 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Log in
              </a>
              <a
                href="/signup?role=client"
                style={{
                  color: '#00267F',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: '1.5px solid #00267F',
                  backgroundColor: 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                className="hide-below-lg"
              >
                Join as a Client
              </a>
              <a
                href="/signup?role=freelancer"
                style={{
                  backgroundColor: '#F9C000',
                  color: '#00267F',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d9a800'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F9C000'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                Join as a Freelancer
              </a>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="mobile-hamburger"
          style={{ color: '#374151', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '8px', display: 'none' }}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 768px) {
          .md-search-bar { display: flex !important; }
        }
        @media (min-width: 640px) {
          .desktop-nav { display: flex !important; }
          .mobile-hamburger { display: none !important; }
        }
        @media (max-width: 639px) {
          .mobile-hamburger { display: flex !important; }
        }
        @media (max-width: 1023px) {
          .hide-below-lg { display: none !important; }
        }
      `}</style>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            borderTop: '1px solid rgba(0,38,127,0.08)',
            backgroundColor: '#ffffff',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          className="mobile-hamburger"
        >
          {user ? (
            <>
              <a
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#00267F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>
                <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: 500 }}>
                  {freelancerProfile?.name || user?.user_metadata?.full_name || user?.email}
                </span>
              </a>
              {profileId && (
                <a href={`/freelancers/${profileId}`} onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}>View my profile</a>
              )}
              <a
                href={freelancerProfile ? '/inbox' : '/messages'}
                onClick={() => setMenuOpen(false)}
                style={{ color: '#374151', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Inbox
                {unreadCount > 0 && (
                  <span style={{ minWidth: 18, height: 16, backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>
              <a href="/search" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}>Browse Professionals</a>
              <button
                onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
                style={{ textAlign: 'left', color: '#ef4444', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a href="/search" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}>Browse Professionals</a>
              <a href="/login" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}>Log in</a>
              <a href="/signup?role=client" onClick={() => setMenuOpen(false)} style={{ color: '#00267F', fontWeight: 600, textDecoration: 'none' }}>Join as a Client</a>
              <a
                href="/signup?role=freelancer"
                onClick={() => setMenuOpen(false)}
                style={{ backgroundColor: '#F9C000', color: '#00267F', padding: '10px 16px', borderRadius: '10px', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}
              >
                Join as a Freelancer
              </a>
            </>
          )}
        </div>
      )}
    </header>
  )
}
