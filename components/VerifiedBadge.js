// Verified tick shown next to a freelancer's name across the site
// (search, profile, messages, featured…). Driven by phone_verified OR
// the admin "verified" flag — both mean "we've confirmed this person."
// Presentational only (no hooks) so it works in server components too.
import BadgeGlyph from './badgeArt'

export default function VerifiedBadge({ size = 16, withLabel = false, label = 'Verified' }) {
  return (
    <span
      title="Verified: identity confirmed by Vetted.bb"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', lineHeight: 0 }}
    >
      <BadgeGlyph kind="verified" size={size} label="Verified" />
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
