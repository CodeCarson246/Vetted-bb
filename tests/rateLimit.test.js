import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rateLimit, rateLimitLocal, storedKey, clientIp, ipv6Network } from '../lib/rateLimit.js'

test('allows up to the limit, then blocks (this server\'s count)', () => {
  const key = `test-${Date.now()}`
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimitLocal(key, { limit: 3, windowMs: 60_000 }), true)
  }
  assert.equal(rateLimitLocal(key, { limit: 3, windowMs: 60_000 }), false)
})

test('separate keys have separate budgets', () => {
  const a = `test-a-${Date.now()}`
  const b = `test-b-${Date.now()}`
  assert.equal(rateLimitLocal(a, { limit: 1, windowMs: 60_000 }), true)
  assert.equal(rateLimitLocal(a, { limit: 1, windowMs: 60_000 }), false)
  assert.equal(rateLimitLocal(b, { limit: 1, windowMs: 60_000 }), true)
})

test('without a database it falls back to this server\'s count, and still limits', async () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const key = `fallback-${Date.now()}`
    assert.equal(await rateLimit(key, { limit: 2, windowMs: 60_000 }), true)
    assert.equal(await rateLimit(key, { limit: 2, windowMs: 60_000 }), true)
    assert.equal(await rateLimit(key, { limit: 2, windowMs: 60_000 }), false)
  } finally {
    if (saved !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved
  }
})

test('stored keys keep the route name and hash the rest', () => {
  const k = storedKey('notify:203.0.113.7')
  assert.match(k, /^notify:[0-9a-f]{32}$/)
  assert.doesNotMatch(k, /203\.0\.113\.7/)
  assert.equal(storedKey('notify:203.0.113.7'), k)
  assert.notEqual(storedKey('notify:203.0.113.8'), k)
  assert.notEqual(storedKey('signup:203.0.113.7'), k)
  assert.match(storedKey('no-colon'), /^limit:[0-9a-f]{32}$/)
})

test('an IPv6 address is limited by its network, so one home cannot rotate through billions of addresses', () => {
  const from = ip => clientIp(new Request('http://x', { headers: { 'x-forwarded-for': ip } }))
  assert.equal(from('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64')
  assert.equal(from('2001:db8:1:2:1111:2222:3333:4444'), '2001:db8:1:2::/64')   // same home, same budget
  assert.notEqual(from('2001:db8:1:3::1'), from('2001:db8:1:2::1'))             // the house next door
  assert.equal(from('2001:0db8:0001:0002::1'), '2001:db8:1:2::/64')
  assert.equal(from('2001:db8::1'), '2001:db8:0:0::/64')
  assert.equal(ipv6Network('::1'), '0:0:0:0::/64')
  // IPv4 (and IPv4 written inside IPv6) is left as it is
  assert.equal(from('203.0.113.7'), '203.0.113.7')
  assert.equal(from('203.0.113.7, 10.0.0.1'), '203.0.113.7')
  assert.equal(from('::ffff:203.0.113.7'), '::ffff:203.0.113.7')
  assert.equal(clientIp(new Request('http://x')), 'unknown')
})

// A route that knows who is asking must limit that PERSON. Limiting only the
// connection treats a whole office, ministry or mobile network as one user.
test('every signed-in route limits per person, not only per connection', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'api')
  const problems = []
  let checked = 0
  for (const name of readdirSync(root)) {
    const file = path.join(root, name, 'route.js')
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    if (!/\brateLimit\(/.test(src)) continue
    const signedIn = /signedInUser\(|auth\.getUser\(/.test(src)
    if (!signedIn) continue
    checked++
    if (!/rateLimit\(`[\w-]+:\$\{user\.id\}`/.test(src)) problems.push(name)
  }
  assert.ok(checked >= 9, `expected the signed-in rate-limited routes, found ${checked}`)
  assert.deepEqual(problems, [], 'signed-in routes limited by connection only')
})

// rateLimit() returns a Promise. Without `await`, `!rateLimit(...)` is always
// false and the limit silently never applies. Read every route and fail on
// any call that is not awaited.
test('every call to rateLimit in the app is awaited', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (name.endsWith('.js')) out.push(p)
    }
    return out
  }
  const problems = []
  let calls = 0
  for (const file of ['app', 'components', 'lib'].flatMap(d => walk(path.join(root, d)))) {
    if (file.endsWith(path.join('lib', 'rateLimit.js'))) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(await\s*)?\brateLimit\(/g)) {
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue
      calls++
      if (!m[1]) problems.push(`${path.relative(root, file)}:${src.slice(0, m.index).split('\n').length}`)
    }
  }
  assert.ok(calls >= 12, `expected the 12 rate-limited routes, found ${calls} calls`)
  assert.deepEqual(problems, [], 'rateLimit() called without await')
})
