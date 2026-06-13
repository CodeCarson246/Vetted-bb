// Verified tick shown next to a freelancer's name across the site
// (search, profile, messages, featured…). Driven by phone_verified OR
// the admin "verified" flag — both mean "we've confirmed this person."
// Presentational only (no hooks) so it works in server components too.
export default function VerifiedBadge({ size = 16, withLabel = false, label = 'Verified' }) {
  return (
    <span
      title="Verified — identity confirmed by Vetted.bb"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', lineHeight: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="11" fill="#1D9BF0" />
        <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withLabel && (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7EC2FF', letterSpacing: '0.02em' }}>{label}</span>
      )}
    </span>
  )
}

// Convenience: true when a freelancer row should show the badge.
export function isVerified(f) {
  return !!(f?.phone_verified || f?.verified)
}
