import VerifiedBadge from './VerifiedBadge'

// The site's family of trust marks, so every badge is drawn the same way
// everywhere and explained in one place (/badges). Presentational only: no
// hooks, so it works in server components and inside links.
//
//   verified      blue tick        a professional whose identity we confirmed
//   organisation  gold tick        an organisation we checked is genuine
//   vendor        navy shield      a professional registered with Treasury
//   featured      gold star pill   a professional we are highlighting
export const TRUST_MARKS = {
  verified: {
    title: 'Verified professional',
    short: 'Verified',
    explain: 'Vetted.bb has confirmed this person is who they say they are, by phone verification or a manual check.',
  },
  organisation: {
    title: 'Verified organisation',
    short: 'Verified organisation',
    explain: 'Vetted.bb has manually checked that this organisation is genuine, so a professional can trust an enquiry from it.',
  },
  vendor: {
    title: 'Registered government vendor',
    short: 'Govt vendor',
    explain: 'This professional has told us they are registered as a vendor with the Treasury, which government departments need before they can pay a supplier.',
  },
  featured: {
    title: 'Featured professional',
    short: 'Featured',
    explain: 'A professional Vetted.bb is highlighting on the homepage and in search.',
  },
}

export default function TrustMark({ kind, size = 16, withLabel = false, label }) {
  const meta = TRUST_MARKS[kind]
  if (!meta) return null
  const text = label || meta.short

  if (kind === 'verified') {
    return <VerifiedBadge size={size} withLabel={withLabel} label={text} />
  }

  if (kind === 'organisation') {
    return (
      <span title={`${meta.title}: ${meta.explain}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', lineHeight: 0 }}>
        <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={meta.title} style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="11" fill="#F9C000" />
          <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="#00267F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {withLabel && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#B45309', letterSpacing: '0.02em' }}>{text}</span>}
      </span>
    )
  }

  if (kind === 'vendor') {
    const h = Math.round(size * 1.15)
    return (
      <span
        title={`${meta.title}: ${meta.explain}`}
        role="img"
        aria-label={meta.title}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', backgroundColor: '#00267F', color: '#fff', borderRadius: 999, padding: `0 ${Math.round(size * 0.5)}px`, height: h, fontSize: Math.max(9, Math.round(size * 0.62)), fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', lineHeight: 1 }}
      >
        <svg width={Math.round(size * 0.7)} height={Math.round(size * 0.7)} viewBox="0 0 24 24" fill="none" stroke="#F9C000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        {text}
      </span>
    )
  }

  // featured
  return (
    <span
      title={`${meta.title}: ${meta.explain}`}
      role="img"
      aria-label={meta.title}
      style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', backgroundColor: '#F9C000', color: '#00267F', borderRadius: 999, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap' }}
    >
      ★ {text}
    </span>
  )
}
