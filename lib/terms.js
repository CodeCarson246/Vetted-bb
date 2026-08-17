// Bump this whenever the Terms of Service change in a way that needs fresh
// consent (keep it in step with the "Last updated" date on /terms). Logged-in
// users whose recorded acceptance doesn't match are re-prompted to accept via
// the TermsUpdateNotice banner. Acceptance is stored in auth user_metadata as
// terms_accepted_version + terms_accepted_at.
export const TERMS_VERSION = '2026-08-16'

export function hasAcceptedCurrentTerms(user) {
  return user?.user_metadata?.terms_accepted_version === TERMS_VERSION
}
