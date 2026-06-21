'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ICONS = {
  dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />,
  inbox: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  earnings: <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  user: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  search: <><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/inbox', label: 'Inbox', icon: 'inbox', badge: true },
  { href: '/quotes', label: 'Quotes & earnings', icon: 'earnings' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

function NavIcon({ name, active }) {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
      style={{ color: active ? '#F9C000' : 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
      {ICONS[name]}
    </svg>
  )
}

export default function WorkspaceSidebar({ open, onClose }) {
  const { user } = useAuth()
  const pathname = usePathname() || ''
  const [profile, setProfile] = useState(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) { setProfile(null); setUnread(0); return }
    let cancelled = false
    async function load() {
      const { data: fp } = await supabase
        .from('freelancers')
        .select('id, name, trade, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setProfile(fp || null)
      if (fp) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('freelancer_id', fp.id).eq('read', false)
        if (!cancelled) setUnread(count || 0)
      }
    }
    load()
    const onRefresh = () => load()
    window.addEventListener('vetted:refresh-unread', onRefresh)
    return () => { cancelled = true; window.removeEventListener('vetted:refresh-unread', onRefresh) }
  }, [user, pathname])

  const isActive = href => pathname === href || pathname.startsWith(href + '/')
  const initials = (profile?.name || user?.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const linkBase = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors'

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-[60] md:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />}
      <aside
        className={`fixed top-0 left-0 z-[70] h-screen w-[244px] flex flex-col transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: '#001652' }}
      >
        {/* Logo */}
        <a href="/dashboard" onClick={onClose} className="flex items-center px-6 flex-shrink-0" style={{ height: 68, textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.5px', lineHeight: 1 }}>
            <span style={{ color: '#fff' }}>Vetted</span><span style={{ color: '#F9C000' }}>.</span><span style={{ color: '#fff' }}>bb</span>
          </span>
        </a>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
          {NAV.map(item => {
            const active = isActive(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={linkBase}
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.72)', backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent' }}
              >
                <NavIcon name={item.icon} active={active} />
                <span className="flex-1">{item.label}</span>
                {item.badge && unread > 0 && (
                  <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </a>
            )
          })}

          <div className="my-3 mx-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

          {profile && (
            <a href={`/freelancers/${profile.id}`} onClick={onClose} className={linkBase} style={{ color: 'rgba(255,255,255,0.72)' }}>
              <NavIcon name="user" /> <span className="flex-1">View public profile</span>
            </a>
          )}
          <a href="/search" onClick={onClose} className={linkBase} style={{ color: 'rgba(255,255,255,0.72)' }}>
            <NavIcon name="search" /> <span className="flex-1">Browse marketplace</span>
          </a>
        </nav>

        {/* Profile footer */}
        <a href="/dashboard" onClick={onClose} className="flex items-center gap-3 px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F9C000', color: '#00267F', fontWeight: 700, fontSize: '0.78rem' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{profile?.name || 'Your profile'}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{profile?.trade || 'Freelancer'}</p>
          </div>
        </a>
      </aside>
    </>
  )
}
