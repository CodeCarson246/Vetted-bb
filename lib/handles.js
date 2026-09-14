// Profile handles: /freelancers/ThinkSports instead of /freelancers/<uuid>.
// The rules are enforced in the database (SUPABASE_SQL.sql section 32,
// handle_problem); this file mirrors the format check for instant
// feedback and turns the database's short codes into sentences.

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30
// Letters, digits and hyphens, no leading or trailing hyphen, 3-30 chars.
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/i

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = value => UUID_RE.test(String(value || ''))

// The public path for a freelancer: their handle when they have one,
// the uuid otherwise. Old uuid links keep working (the page redirects).
export function profileUrl(f) {
  const key = f?.handle || f?.id
  return key ? `/freelancers/${key}` : '/search'
}

// A starting point from the person's name: "Carson Pitts" -> "CarsonPitts".
export function suggestHandle(name) {
  const words = String(name || '').split(/[^A-Za-z0-9]+/).filter(Boolean)
  const joined = words.map(w => w[0].toUpperCase() + w.slice(1)).join('')
  const cleaned = joined.replace(/[^A-Za-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, HANDLE_MAX)
  return cleaned.length >= HANDLE_MIN ? cleaned : ''
}

export const HANDLE_PROBLEMS = {
  format: `Use ${HANDLE_MIN} to ${HANDLE_MAX} letters, numbers or hyphens, starting and ending with a letter or number.`,
  reserved: 'That one is reserved. Try something more personal.',
  profanity: 'That handle would not look right on a business card. Try another.',
  taken: 'Someone already has that handle.',
  cooldown: 'You changed your handle recently. You can change it again in 30 days.',
  not_owner: 'You can only set a handle on your own profile.',
}
