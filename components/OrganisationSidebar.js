'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { fetchMyOrganisation, readCachedOrganisation } from '@/lib/organisations'

// Workspace sidebar for organisation accounts. Mirrors the freelancer
// sidebar's look so the two workspaces feel like one product, but the nav
// is the organisation's job: find professionals, run enquiries, track jobs,
// manage the team.
const ICONS = {
  dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />,
  search: <><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3" /></>,
  saved: <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
  messages: <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  jobs: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
  requests: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4" />,
  records: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM9 6v12" />,
  team: <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  settings: <><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
}

const NAV = [
  { href: '/organisation', label: 'Dashboard', icon: 'dashboard', exact: true },
  { href: '/search', label: 'Find professionals', icon: 'search' },
  { href: '/saved', label: 'Shortlist', icon: 'saved' },
  { href: '/messages', label: 'Enquiries', icon: 'messages' },
  { href: '/organisation/requests', label: 'Quote requests', icon: 'requests' },
  { href: '/organisation/records', label: 'Records', icon: 'records' },
  { href: '/jobs', label: 'Quotes & jobs', icon: 'jobs' },
  { href: '/organisation/team', label: 'Team', icon: 'team' },
  { href: '/organisation/settings', label: 'Settings', icon: 'settings' },
]

function NavIcon({ name, active }) {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
      style={{ color: active ? '#F9C000' : 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
      {ICONS[name]}
    </svg>
  )
}

export default function OrganisationSidebar({ open, onClose }) {
  const { user } = useAuth()
  const pathname = usePathname() || ''
  const [org, setOrg] = useState(() => (typeof window === 'undefined' ? null : readCachedOrganisation()))

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears cached org when the session ends; same pattern as WorkspaceSidebar
    if (!user) { setOrg(null); return }
    let cancelled = false
    fetchMyOrganisation().then(entry => {
      if (cancelled) return
      setOrg(entry ? { id: entry.organisation.id, name: entry.organisation.name, verified: !!entry.organisation.verified, role: entry.role } : null)
    })
    return () => { cancelled = true }
  }, [user, pathname])

  const isActive = (item) => item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + '/'))
  const initials = (org?.name || user?.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const linkBase = 'flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-xl text-sm font-medium transition-colors'

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-[60] md:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />}
      <aside
        className={`fixed top-0 left-0 z-[70] h-screen w-[244px] flex flex-col transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: '#001652' }}
      >
        <Link href="/" onClick={onClose} className="flex items-center px-6 flex-shrink-0" style={{ height: 60, textDecoration: 'none' }}>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.5px', lineHeight: 1 }}>
            <span style={{ color: '#fff' }}>Vetted</span><span style={{ color: '#F9C000' }}>.</span><span style={{ color: '#fff' }}>bb</span>
          </span>
        </Link>

        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
          {NAV.map(item => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={linkBase}
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.72)', backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent' }}
              >
                <NavIcon name={item.icon} active={active} />
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}

          <div className="mt-auto pt-2 px-3 pb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/terms" onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textDecoration: 'none' }}>Terms of Service</Link>
            <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem' }}>·</span>
            <Link href="/privacy" onClick={onClose} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textDecoration: 'none' }}>Privacy Policy</Link>
          </div>
        </nav>

        {/* Organisation footer */}
        <Link href="/organisation" onClick={onClose} className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F9C000', color: '#00267F', fontWeight: 700, fontSize: '0.78rem' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: '#fff' }}>
              <span className="truncate">{org?.name || 'Your organisation'}</span>
              {org?.verified && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F9C000" aria-label="Verified organisation" style={{ flexShrink: 0 }}>
                  <path d="M12 2l2.4 2.1 3.1-.5 1 3 2.9 1.3-.6 3.1 2 2.4-2 2.4.6 3.1-2.9 1.3-1 3-3.1-.5L12 22l-2.4-2.1-3.1.5-1-3-2.9-1.3.6-3.1L1.2 12l2-2.4-.6-3.1 2.9-1.3 1-3 3.1.5L12 2zm-1.2 13.4l5.5-5.5-1.4-1.4-4.1 4.1-2-2-1.4 1.4 3.4 3.4z" />
                </svg>
              )}
            </p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{org?.role === 'owner' ? 'Owner' : 'Member'}</p>
          </div>
        </Link>
      </aside>
    </>
  )
}
