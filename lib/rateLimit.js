/**
 * Minimal in-memory sliding-window rate limiter for API routes.
 *
 * Per serverless instance only — a determined attacker spread across
 * instances can exceed it, so treat this as a speed bump, not the
 * security boundary. The real protections are auth checks and RLS.
 */
const buckets = new Map()

export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter(t => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  // Opportunistic cleanup so the map doesn't grow unbounded
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every(t => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}

export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'unknown'
}
