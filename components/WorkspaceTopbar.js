'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'

// Slim top bar for the freelancer workspace — hamburger (mobile) + marketplace
// search on the left, notifications + theme on the right. The avatar/profile
// lives in the sidebar.
export default function WorkspaceTopbar({ onMenuClick }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 flex-shrink-0"
      style={{ height: 68, backgroundColor: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-card)' }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="md:hidden p-2 -ml-1"
        style={{ color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <form onSubmit={onSubmit} className="relative flex-1" style={{ maxWidth: 380 }}>
        <button type="submit" aria-label="Search" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <input
          type="text"
          placeholder="Search professionals…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full text-sm text-gray-900 outline-none"
          style={{ paddingLeft: 36, paddingRight: 14, height: 40, borderRadius: 999, backgroundColor: 'var(--row-stripe)', border: '1px solid var(--border-card)' }}
        />
      </form>

      <div className="flex-1 hidden sm:block" />
      <NotificationBell />
      <ThemeToggle />
    </header>
  )
}
