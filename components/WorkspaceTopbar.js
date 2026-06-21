'use client'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'

// Slim top bar for the freelancer workspace — hamburger (mobile) on the left,
// notifications + theme on the right. The avatar/profile lives in the sidebar.
export default function WorkspaceTopbar({ onMenuClick }) {
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
      <div className="flex-1" />
      <NotificationBell />
      <ThemeToggle />
    </header>
  )
}
