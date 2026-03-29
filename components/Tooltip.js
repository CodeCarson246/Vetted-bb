'use client'
import { useState, useEffect, useRef } from 'react'

// Reusable tooltip. Hover on desktop, tap-to-toggle on mobile.
// Position: below on mobile (top-full), above on sm+ (bottom-full).
export default function Tooltip({ text, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click (mobile tap-away)
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [open])

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
    >
      {children}
      {open && (
        <span
          className="absolute left-1/2 -translate-x-1/2 z-50 w-56 rounded-lg px-3 py-2.5 text-xs text-white leading-relaxed pointer-events-none"
          style={{
            backgroundColor: '#0d1b4b',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            // Below on mobile, above on sm+
            // Controlled via inline style for reliability across contexts
            top: 'calc(100% + 6px)',
          }}
        >
          {text}
          {/* Arrow pointing up (tooltip is below the icon) */}
          <span
            className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderBottomColor: '#0d1b4b' }}
          />
        </span>
      )}
    </span>
  )
}
