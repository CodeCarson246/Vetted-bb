import test from 'node:test'
import assert from 'node:assert/strict'

// A minimal localStorage, installed before the module under test reads it.
class MemoryStorage {
  constructor() { this.map = new Map() }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
}
const store = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true })

const { readDashboardCache, writeDashboardCache, clearDashboardCache, clearAllDashboardCaches } = await import('../lib/dashboardCache.js')

const DAY = 24 * 60 * 60 * 1000

test('saves and restores a dashboard per account', () => {
  const now = Date.UTC(2026, 8, 15)
  assert.equal(writeDashboardCache('user-a', { role: 'freelancer', profile: { name: 'Carson' }, unreadCount: 2 }, now), true)
  assert.deepEqual(readDashboardCache('user-a', now + 1000), { role: 'freelancer', profile: { name: 'Carson' }, unreadCount: 2 })
  assert.equal(readDashboardCache('user-b', now), null)
})

test('a copy older than a week is thrown away', () => {
  const now = Date.UTC(2026, 8, 15)
  writeDashboardCache('user-old', { role: 'client' }, now)
  assert.ok(readDashboardCache('user-old', now + 6 * DAY))
  assert.equal(readDashboardCache('user-old', now + 8 * DAY), null)
  assert.equal(store.getItem('vetted_dash_v1:user-old'), null)
})

test('oversized or unreadable data is refused rather than breaking the page', () => {
  assert.equal(writeDashboardCache('user-big', { blob: 'x'.repeat(1_100_000) }), false)
  store.setItem('vetted_dash_v1:user-bad', '{not json')
  assert.equal(readDashboardCache('user-bad'), null)
  assert.equal(writeDashboardCache(null, { role: 'client' }), false)
})

test('signing out clears every saved dashboard but leaves other settings alone', () => {
  store.setItem('vetted_theme', 'dark')
  writeDashboardCache('user-x', { role: 'client' })
  writeDashboardCache('user-y', { role: 'freelancer' })
  clearDashboardCache('user-x')
  assert.equal(readDashboardCache('user-x'), null)
  assert.ok(readDashboardCache('user-y'))
  clearAllDashboardCaches()
  assert.equal(readDashboardCache('user-y'), null)
  assert.equal(store.getItem('vetted_theme'), 'dark')
})
