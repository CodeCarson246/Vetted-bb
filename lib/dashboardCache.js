// The dashboard as this device last saw it, so reopening it (or the
// home-screen app after iPhone has closed it in the background) shows real
// content straight away while fresh data loads underneath.
//
// Kept per account, for a week at most, and wiped on sign-out
// (lib/auth-context.js) because it holds the user's own messages, reviews and
// payment details. Every storage call is guarded: private browsing and
// "block site data" settings make localStorage throw.
const PREFIX = 'vetted_dash_v1:'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CHARS = 1_000_000

function storage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function readDashboardCache(userId, now = Date.now()) {
  const s = storage()
  if (!s || !userId) return null
  try {
    const raw = s.getItem(PREFIX + userId)
    if (!raw) return null
    const { savedAt, data } = JSON.parse(raw)
    if (!data || typeof savedAt !== 'number' || now - savedAt > MAX_AGE_MS) {
      s.removeItem(PREFIX + userId)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function writeDashboardCache(userId, data, now = Date.now()) {
  const s = storage()
  if (!s || !userId || !data) return false
  try {
    const raw = JSON.stringify({ savedAt: now, data })
    if (raw.length > MAX_CHARS) return false
    s.setItem(PREFIX + userId, raw)
    return true
  } catch {
    return false
  }
}

export function clearDashboardCache(userId) {
  const s = storage()
  if (!s || !userId) return
  try { s.removeItem(PREFIX + userId) } catch { /* ignore */ }
}

export function clearAllDashboardCaches() {
  const s = storage()
  if (!s) return
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const key = s.key(i)
      if (key && key.startsWith(PREFIX)) s.removeItem(key)
    }
  } catch { /* ignore */ }
}

// Other workspace pages (the inbox, Quotes & earnings) keep their own saved
// copy in the same store, under their own key, so the sign-out wipe above
// clears them too.
export function readPageCache(page, userId, now) {
  return readDashboardCache(page && userId ? `${page}:${userId}` : null, now)
}

export function writePageCache(page, userId, data, now) {
  return writeDashboardCache(page && userId ? `${page}:${userId}` : null, data, now)
}
