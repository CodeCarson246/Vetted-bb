'use client'
import { useEffect, useRef } from 'react'

// One bubble of the guided profile-setup tour. Rendered inline directly under
// the field it explains (robust on mobile — no floating-position math), with
// an arrow pointing up at the field, benefit-focused copy, and Next/Skip.
export default function CoachTip({ show, step, total, title, children, onNext, onSkip, nextLabel = 'Next →' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!show || !ref.current) return
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null

  return (
    <div ref={ref} className="relative mt-2.5" style={{ animation: 'coachTipIn 0.25s ease' }}>
      <style>{`@keyframes coachTipIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        style={{
          position: 'absolute', top: -6, left: 26, width: 12, height: 12,
          transform: 'rotate(45deg)', backgroundColor: '#FEF9EC',
          borderLeft: '1.5px solid #F9C000', borderTop: '1.5px solid #F9C000',
        }}
        aria-hidden="true"
      />
      <div style={{ backgroundColor: '#FEF9EC', border: '1.5px solid #F9C000', borderRadius: 12, padding: '13px 15px', boxShadow: '0 4px 14px rgba(0,38,127,0.08)' }}>
        <p className="text-sm font-bold" style={{ color: '#00267F', margin: 0 }}>💡 {title}</p>
        <p className="text-xs mt-1.5" style={{ color: '#374151', lineHeight: 1.6, margin: '6px 0 0' }}>{children}</p>
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-[11px] font-medium" style={{ color: '#b45309' }}>Tip {step} of {total}</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium px-2 py-1.5 hover:opacity-70 transition-opacity"
              style={{ color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={onNext}
              className="text-xs font-bold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              {nextLabel}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
