'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function SiteNav() {
  const { user } = useAuth()
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function loadProfile(u) {
      if (u && u.user_metadata?.role !== 'client') {
        const { data: fp } = await supabase
          .from('freelancers')
          .select('id, name, avatar_url')
          .eq('user_id', u.id)
          .single()
        setFreelancerProfile(fp || null)
        if (fp) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('freelancer_id', fp.id)
            .eq('read', false)
          setUnreadCount(count || 0)
        }
      } else {
        setFreelancerProfile(null)
        setUnreadCount(0)
      }
    }

    loadProfile(user)
  }, [user])

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
        justifyContent: 'space-between',
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
        }}>
          <span style={{ color: '#00267F' }}>Vetted</span>
          <span style={{ color: '#F9C000' }}>.</span>
          <span style={{ color: '#00267F' }}>bb</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-3">
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
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Browse Professionals
          </a>

          {user ? (
            <>
              {freelancerProfile ? (
                <a
                  href="/dashboard"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#00267F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                    {freelancerProfile.avatar_url
                      ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: 500 }}>{freelancerProfile.name}</span>
                </a>
              ) : (
                <a href="/dashboard" style={{ color: '#374151', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
                  {user?.user_metadata?.full_name || user?.email}
                </a>
              )}

              {freelancerProfile ? (
                <a href="/inbox" style={{ position: 'relative', padding: '6px', color: '#6B7280', textDecoration: 'none', display: 'inline-flex' }}>
                  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 2px', lineHeight: 1 }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </a>
              ) : (
                <a href="/messages" style={{ padding: '6px', color: '#6B7280', textDecoration: 'none', display: 'inline-flex' }}>
                  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              )}

              <button
                onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
                style={{
                  backgroundColor: '#00267F',
                  color: 'white',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Log out
              </button>
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
                  display: 'inline-block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Log in
              </a>
              <a
                href="/signup?role=client"
                className="hidden lg:inline-block"
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
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,38,127,0.06)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
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
                  display: 'inline-block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d9a800'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F9C000'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                Join as a Freelancer
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2"
          style={{ color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <svg style={{ width: 24, height: 24 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="sm:hidden"
          style={{
            borderTop: '1px solid rgba(0,38,127,0.08)',
            backgroundColor: '#ffffff',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {user ? (
            <>
              {freelancerProfile ? (
                <a href="/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#00267F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                    {freelancerProfile.avatar_url
                      ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: 500 }}>{freelancerProfile.name}</span>
                </a>
              ) : (
                <a href="/dashboard" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
                  {user?.user_metadata?.full_name || user?.email}
                </a>
              )}
              {freelancerProfile ? (
                <a href="/inbox" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Inbox
                  {unreadCount > 0 && (
                    <span style={{ minWidth: 18, height: 16, backgroundColor: '#ef4444', color: 'white', fontSize: '0.65rem', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </a>
              ) : (
                <a href="/messages" onClick={() => setMenuOpen(false)} style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}>My messages</a>
              )}
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
                style={{
                  backgroundColor: '#F9C000',
                  color: '#00267F',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
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
