// The Rising Talent badge: given by Vetted.bb to members of the Vetted Rising
// programme, and shown for their first 90 days. The Vetted Rising page
// promises exactly that, so the length lives here and nowhere else.
//
// freelancers.rising_since is set (and cleared) only from the admin panel,
// through /api/admin. The badge ends by itself: nothing has to run on day 91.
export const RISING_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

function startOf(f) {
  const at = Date.parse(f?.rising_since || '')
  return Number.isFinite(at) ? at : null
}

/** Does this professional carry the Rising Talent badge right now? */
export function isRising(f, now = Date.now()) {
  const at = startOf(f)
  return at !== null && now >= at && now - at < RISING_DAYS * DAY_MS
}

/** When the badge ends, as a Date, or null if it was never given. */
export function risingEndsAt(f) {
  const at = startOf(f)
  return at === null ? null : new Date(at + RISING_DAYS * DAY_MS)
}
