import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * Rate limits for the API routes, counted in the database so they hold
 * across every Vercel server (SQL Section 46: rate_limits, rate_limit_hit).
 *
 *   if (!(await rateLimit(`notify:${clientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 }))) ...
 *
 * Two layers:
 *   1. this server's own memory: free, and stops a burst before it costs a
 *      database call;
 *   2. the shared count in Supabase: the real limit.
 *
 * If the database cannot answer (not configured, SQL not run yet, an
 * outage) or does not answer within DB_WAIT_MS, the request is let through
 * on the memory check alone: a slow database must not hold every enquiry,
 * sign-up and booking waiting behind the limiter. A limiter
 * that failed closed would lock real people out of signing up or sending an
 * enquiry; the sign-in and ownership checks in each route still apply.
 *
 * ALWAYS await it: without `await` the result is a Promise, which is never
 * falsy, so the limit would silently never apply. tests/rateLimit.test.js
 * checks every route for that.
 */
const buckets = new Map()
// How long the shared count may take before the request goes ahead without it.
const DB_WAIT_MS = 1500

/** This server's own count only (a sliding window of timestamps). */
export function rateLimitLocal(key, { limit = 5, windowMs = 60_000 } = {}) {
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

/**
 * The key as stored: the route's name stays readable ("notify"), the rest
 * (an IP address or a user id) is hashed, so the table holds no personal
 * details in readable form.
 */
export function storedKey(key) {
  const s = String(key)
  const i = s.indexOf(':')
  const name = i >= 0 ? s.slice(0, i) : 'limit'
  const rest = i >= 0 ? s.slice(i + 1) : s
  return `${name}:${createHash('sha256').update(rest).digest('hex').slice(0, 32)}`
}

let client = null
function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!client) client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export async function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
  if (!rateLimitLocal(key, { limit, windowMs })) return false
  const db = database()
  if (!db || typeof db.rpc !== 'function') return true
  let timer
  try {
    const answer = await Promise.race([
      db.rpc('rate_limit_hit', {
        p_key: storedKey(key),
        p_limit: limit,
        p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      }),
      new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), DB_WAIT_MS) }),
    ])
    if (!answer || answer.timedOut || answer.error) return true
    return answer.data !== false
  } catch {
    return true
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The connection a request came from, for limit keys. An IPv6 address is cut
 * to its network (the first 64 bits): one home or phone is handed a whole
 * /64, so counting single addresses would give it a fresh budget for every
 * one of its billions of addresses.
 */
export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : ''
  if (!ip) return 'unknown'
  return ip.includes(':') && !ip.includes('.') ? ipv6Network(ip) : ip
}

/** "2001:db8:1:2:aaaa:bbbb:cccc:dddd" -> "2001:db8:1:2::/64" (handles "::"). */
export function ipv6Network(ip) {
  const [head, tail] = String(ip).toLowerCase().split('%')[0].split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const full = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  if (full.length !== 8) return ip
  return `${full.slice(0, 4).map(h => h.replace(/^0+(?=.)/, '')).join(':')}::/64`
}
