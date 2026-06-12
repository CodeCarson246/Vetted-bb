'use client'
import { useState, useEffect } from 'react'

/**
 * Light/dark switch. The actual theme is applied before hydration by
 * the inline script in app/layout.js (no flash); this button just
 * flips `data-theme` on <html> and persists the choice.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('vetted_theme', next) } catch { /* private browsing */ }
    setTheme(next)
  }

  if (!theme) return <span style={{ width: 32, height: 32, display: 'inline-block' }} />

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        display: 'inline-flex',
        alignItems: 'center',
        color: '#6B7280',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = theme === 'dark' ? '#F9C000' : '#00267F')}
      onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
    >
      {theme === 'dark' ? (
        /* Sun */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        /* Moon */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
