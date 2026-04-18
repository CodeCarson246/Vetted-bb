'use client'
import { useState, useEffect } from 'react'

const phases = [
  {
    side: 'left',
    statusLabel: 'Phase 1 — Live',
    statusBg: '#DCFCE7',
    statusColor: '#166534',
    borderTop: '#22C55E',
    node: 'navy',
    title: 'The Foundation',
    description: 'Everything you need to find, trust, and contact a professional in Barbados.',
    tags: ['Verified profiles', 'Search & discovery', 'Quote builder', 'Two-way reviews', 'Messaging'],
    tagBg: '#DCFCE7',
    tagColor: '#166534',
  },
  {
    side: 'right',
    statusLabel: 'Phase 2 — In Progress',
    statusBg: '#FEF3C7',
    statusColor: '#92400E',
    borderTop: '#00267F',
    node: 'pulse',
    title: 'Trust & Reach',
    description: 'Identity verification and mobile access — making Vetted.bb the platform you carry in your pocket.',
    tags: ['Phone verification', 'Add to home screen', 'Push notifications', 'Quotes page'],
    tagBg: '#EFF6FF',
    tagColor: '#1E40AF',
  },
  {
    side: 'left',
    statusLabel: 'Phase 3 — Coming Soon',
    statusBg: '#F3F4F6',
    statusColor: '#6B7280',
    borderTop: '#D1D5DB',
    node: 'empty',
    title: 'Growth Tools',
    description: 'Features that help freelancers grow their business and help clients make smarter decisions.',
    tags: ['Analytics dashboard', 'Featured listings', 'Category SEO pages', 'Client profiles'],
    tagBg: '#F3F4F6',
    tagColor: '#6B7280',
  },
  {
    side: 'right',
    statusLabel: 'Phase 4 — The Vision',
    statusBg: '#F3F4F6',
    statusColor: '#6B7280',
    borderTop: '#D1D5DB',
    node: 'empty',
    title: 'The App',
    description: "A fully native mobile experience on iOS and Android — Barbados's professional services platform, fully in your hands.",
    tags: ['iOS app', 'Android app', 'Booking history', 'In-app payments'],
    tagBg: '#F3F4F6',
    tagColor: '#6B7280',
  },
]

const voteOptions = [
  { id: 'client-profiles', label: 'Client profiles', sub: "Track who you've hired", pct: 54 },
  { id: 'analytics', label: 'Analytics', sub: 'Profile views and stats', pct: 31 },
  { id: 'instant-booking', label: 'Instant booking', sub: 'Book without messaging', pct: 15 },
]

const changelog = [
  { date: 'Apr 2026', desc: 'Platform launched', badge: 'Launch', badgeBg: '#DCFCE7', badgeColor: '#166534' },
  { date: 'Apr 2026', desc: 'Quote builder with PDF export', badge: 'Feature', badgeBg: '#EFF6FF', badgeColor: '#1E40AF' },
  { date: 'Apr 2026', desc: 'Two-way reviews system live', badge: 'Feature', badgeBg: '#EFF6FF', badgeColor: '#1E40AF' },
  { date: 'Apr 2026', desc: 'Availability calendar on all profiles', badge: 'Feature', badgeBg: '#EFF6FF', badgeColor: '#1E40AF' },
]

function PhaseNode({ type }) {
  const shared = { width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }
  if (type === 'navy') {
    return (
      <div style={{
        ...shared,
        backgroundColor: '#00267F',
        boxShadow: '0 0 0 3px #F3F4F8, 0 0 0 5px #00267F',
        position: 'relative', zIndex: 1,
      }} />
    )
  }
  if (type === 'pulse') {
    return (
      <div style={{ ...shared, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="rm-pulse-ring" style={{
          position: 'absolute',
          width: 36, height: 36,
          borderRadius: '50%',
          backgroundColor: 'rgba(249,192,0,0.28)',
        }} />
        <div style={{
          ...shared,
          backgroundColor: '#F9C000',
          boxShadow: '0 0 0 3px #F3F4F8, 0 0 0 5px #F9C000',
          position: 'relative', zIndex: 2,
        }} />
      </div>
    )
  }
  return (
    <div style={{
      ...shared,
      backgroundColor: '#F3F4F8',
      border: '2px solid #D1D5DB',
      position: 'relative', zIndex: 1,
    }} />
  )
}

function PhaseCard({ phase }) {
  const muted = phase.borderTop === '#D1D5DB'
  return (
    <div style={{
      backgroundColor: 'white',
      border: `1px solid ${muted ? '#E5E7EB' : 'rgba(0,38,127,0.1)'}`,
      borderTop: `4px solid ${phase.borderTop}`,
      borderRadius: '16px',
      boxShadow: muted ? '0 1px 6px rgba(0,0,0,0.04)' : '0 2px 12px rgba(0,38,127,0.08)',
      padding: '26px 24px',
    }}>
      <span style={{
        display: 'inline-block',
        fontSize: '0.71rem',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: phase.statusBg,
        color: phase.statusColor,
        marginBottom: '14px',
        letterSpacing: '0.2px',
      }}>
        {phase.statusLabel}
      </span>
      <h2 style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: '1.1rem',
        color: muted ? '#9CA3AF' : '#111827',
        marginBottom: '8px',
        lineHeight: 1.3,
      }}>
        {phase.title}
      </h2>
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.875rem',
        color: muted ? '#9CA3AF' : '#6B7280',
        lineHeight: 1.65,
        marginBottom: '16px',
      }}>
        {phase.description}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {phase.tags.map(tag => (
          <span key={tag} style={{
            fontSize: '0.71rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '999px',
            backgroundColor: phase.tagBg,
            color: phase.tagColor,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Roadmap() {
  const [vote, setVote] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [barsVisible, setBarsVisible] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('vetted_roadmap_vote')
    if (saved) { setVote(saved); setSubmitted(true); setBarsVisible(true) }
  }, [])

  function handleSubmit() {
    if (!vote || submitted) return
    localStorage.setItem('vetted_roadmap_vote', vote)
    setSubmitted(true)
    setTimeout(() => setBarsVisible(true), 50)
  }

  return (
    <main style={{ background: '#F3F4F8', minHeight: '100vh' }}>
      <style>{`
        @keyframes rm-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(2); opacity: 0; }
        }
        .rm-pulse-ring { animation: rm-pulse 2s ease-out infinite; }

        /* Timeline grid */
        .rm-row {
          display: grid;
          grid-template-columns: 1fr 48px 1fr;
          align-items: center;
        }
        .rm-node { display: flex; justify-content: center; align-items: center; position: relative; z-index: 1; }
        .rm-card-l { padding-right: 32px; }
        .rm-card-r { padding-left: 32px; }

        /* Vote grid */
        .rm-vote-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        /* Mobile */
        @media (max-width: 767px) {
          .rm-row { grid-template-columns: 48px 1fr; }
          .rm-empty { display: none !important; }
          .rm-row-l .rm-card-l { grid-column: 2; padding-right: 0; padding-left: 14px; }
          .rm-row-l .rm-node  { grid-column: 1; grid-row: 1; }
          .rm-row-r .rm-card-r { grid-column: 2; padding-left: 14px; }
          .rm-row-r .rm-node  { grid-column: 1; grid-row: 1; }
          .rm-spine { left: 48px !important; transform: none !important; }
        }
        @media (max-width: 600px) {
          .rm-vote-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Hero ── */}
      <section style={{ maxWidth: '780px', margin: '0 auto', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '5px 16px',
          borderRadius: '999px',
          marginBottom: '24px',
          letterSpacing: '0.5px',
        }}>
          Built in public
        </div>
        <h1 style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          color: '#00267F',
          marginBottom: '16px',
          lineHeight: 1.15,
          letterSpacing: '-0.5px',
        }}>
          Where we&apos;re going
        </h1>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '1.05rem',
          color: '#6B7280',
          lineHeight: 1.7,
          maxWidth: '520px',
          margin: '0 auto',
        }}>
          We build in the open. Here&apos;s exactly what&apos;s live, what&apos;s next, and what we&apos;re planning.
        </p>
      </section>

      {/* ── Timeline ── */}
      <section style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px 80px', position: 'relative' }}>
        {/* Spine line */}
        <div className="rm-spine" style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#E5E7EB',
          transform: 'translateX(-50%)',
          zIndex: 0,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '52px', position: 'relative' }}>
          {phases.map((phase, i) => (
            <div
              key={i}
              className={`rm-row ${phase.side === 'left' ? 'rm-row-l' : 'rm-row-r'}`}
            >
              {phase.side === 'left' ? (
                <>
                  <div className="rm-card-l"><PhaseCard phase={phase} /></div>
                  <div className="rm-node"><PhaseNode type={phase.node} /></div>
                  <div className="rm-empty" />
                </>
              ) : (
                <>
                  <div className="rm-empty" />
                  <div className="rm-node"><PhaseNode type={phase.node} /></div>
                  <div className="rm-card-r"><PhaseCard phase={phase} /></div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Voting ── */}
      <section style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid rgba(0,38,127,0.1)',
          borderTop: '4px solid #00267F',
          borderRadius: '16px',
          boxShadow: '0 2px 12px rgba(0,38,127,0.08)',
          padding: '40px 36px',
        }}>
          <h2 style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: '1.4rem',
            color: '#00267F',
            marginBottom: '8px',
          }}>
            What should we build next?
          </h2>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9rem',
            color: '#6B7280',
            marginBottom: '28px',
          }}>
            Vote for the feature you want to see in Phase 3.
          </p>

          <div className="rm-vote-grid" style={{ marginBottom: '28px' }}>
            {voteOptions.map(opt => {
              const selected = vote === opt.id
              const dimmed = submitted && !selected
              return (
                <button
                  key={opt.id}
                  onClick={() => !submitted && setVote(opt.id)}
                  style={{
                    padding: '20px 18px',
                    borderRadius: '12px',
                    border: `2px solid ${selected ? '#00267F' : '#E5E7EB'}`,
                    backgroundColor: selected ? '#EEF2FF' : 'white',
                    cursor: submitted ? 'default' : 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    opacity: dimmed ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!submitted) e.currentTarget.style.borderColor = '#00267F' }}
                  onMouseLeave={e => { if (!submitted && !selected) e.currentTarget.style.borderColor = '#E5E7EB' }}
                >
                  <p style={{
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: selected ? '#00267F' : '#111827',
                    marginBottom: '4px',
                  }}>
                    {opt.label}
                  </p>
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.8rem',
                    color: '#6B7280',
                    marginBottom: '14px',
                    lineHeight: 1.4,
                  }}>
                    {opt.sub}
                  </p>
                  <div style={{ height: 4, borderRadius: '999px', backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      borderRadius: '999px',
                      width: barsVisible ? `${opt.pct}%` : '0%',
                      backgroundColor: selected ? '#00267F' : '#D1D5DB',
                      transition: 'width 0.7s ease',
                    }} />
                  </div>
                  <p style={{
                    fontSize: '0.72rem',
                    color: '#9CA3AF',
                    marginTop: '5px',
                    fontWeight: 600,
                    opacity: barsVisible ? 1 : 0,
                    transition: 'opacity 0.4s',
                  }}>
                    {opt.pct}%
                  </p>
                </button>
              )
            })}
          </div>

          {submitted ? (
            <p style={{
              display: 'inline-block',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.875rem',
              color: '#166534',
              fontWeight: 600,
              padding: '12px 20px',
              borderRadius: '10px',
              backgroundColor: '#DCFCE7',
            }}>
              ✓ Thanks — your vote has been counted.
            </p>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!vote}
              style={{
                padding: '12px 30px',
                borderRadius: '999px',
                backgroundColor: vote ? '#00267F' : '#D1D5DB',
                color: 'white',
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: vote ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.15s',
              }}
            >
              Submit your vote
            </button>
          )}
        </div>
      </section>

      {/* ── Changelog ── */}
      <section style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px 96px' }}>
        <h2 style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: '1.5rem',
          color: '#111827',
          marginBottom: '20px',
        }}>
          Recent updates
        </h2>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          border: '1px solid rgba(0,38,127,0.1)',
          boxShadow: '0 2px 12px rgba(0,38,127,0.07)',
          overflow: 'hidden',
        }}>
          {changelog.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '18px 24px',
                borderBottom: i < changelog.length - 1 ? '1px solid #F3F4F6' : 'none',
                flexWrap: 'wrap',
              }}
            >
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.8rem',
                color: '#9CA3AF',
                minWidth: '72px',
                flexShrink: 0,
              }}>
                {entry.date}
              </span>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.875rem',
                color: '#374151',
                flex: 1,
                minWidth: '160px',
              }}>
                {entry.desc}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '999px',
                backgroundColor: entry.badgeBg,
                color: entry.badgeColor,
                flexShrink: 0,
              }}>
                {entry.badge}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
