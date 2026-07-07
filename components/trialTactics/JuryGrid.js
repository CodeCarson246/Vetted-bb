'use client'
import { leaningOf, countLeanings } from '@/lib/trialTactics/engine'

// 12 juror cards. Colour = current leaning. Shows number, personality,
// leaning label and confidence. Compact + responsive.
export default function JuryGrid({ jurors = [], compact = false }) {
  const tally = countLeanings(jurors)
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(86px, 1fr))'
            : 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: compact ? 8 : 12,
        }}
      >
        {jurors.map((j) => {
          const lean = leaningOf(j.score)
          return (
            <div
              key={j.id}
              style={{
                background: lean.color,
                borderRadius: 10,
                padding: compact ? '8px 6px' : '10px 10px',
                color: '#fff',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                transition: 'background 600ms ease',
              }}
              title={`${lean.label} · confidence ${j.confidence}%`}
            >
              <div style={{ fontWeight: 800, fontSize: compact ? 16 : 20, lineHeight: 1 }}>
                #{j.id}
              </div>
              <div style={{ fontSize: compact ? 10 : 11, opacity: 0.95, marginTop: 4 }}>
                {j.personality}
              </div>
              {!compact && (
                <div style={{ fontSize: 10, opacity: 0.9, marginTop: 4 }}>{lean.label}</div>
              )}
              <div
                style={{
                  marginTop: 6,
                  height: 4,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${j.confidence}%`,
                    height: '100%',
                    background: 'rgba(255,255,255,0.9)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginTop: 14,
          flexWrap: 'wrap',
          fontSize: 13,
          color: '#cbd5e1',
        }}
      >
        <span>
          <strong style={{ color: '#f87171' }}>{tally.pro}</strong> Prosecution
        </span>
        <span>
          <strong style={{ color: '#9ca3af' }}>{tally.undecided}</strong> Undecided
        </span>
        <span>
          <strong style={{ color: '#60a5fa' }}>{tally.def}</strong> Defence
        </span>
      </div>
    </div>
  )
}
