'use client'
import { useState, useEffect, useRef } from 'react'

// Reusable tooltip. Hover on desktop, tap-to-toggle on mobile.
// Accepts either `text` (string) or `content` (JSX) for the tooltip body.
export default function Tooltip({ text, content, children }) {
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
          className="absolute left-1/2 -translate-x-1/2 z-50 rounded-lg text-white leading-relaxed pointer-events-none"
          style={{
            backgroundColor: '#001652',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            top: 'calc(100% + 6px)',
            padding: '10px 14px',
            maxWidth: 200,
            width: 'max-content',
          }}
        >
          {content ?? text}
          {/* Arrow pointing up (tooltip is below the icon) */}
          <span
            className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderBottomColor: '#001652' }}
          />
        </span>
      )}
    </span>
  )
}
