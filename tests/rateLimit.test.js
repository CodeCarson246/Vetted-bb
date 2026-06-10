import test from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit } from '../lib/rateLimit.js'

test('allows up to the limit, then blocks', () => {
  const key = `test-${Date.now()}`
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(key, { limit: 3, windowMs: 60_000 }), true)
  }
  assert.equal(rateLimit(key, { limit: 3, windowMs: 60_000 }), false)
})

test('separate keys have separate budgets', () => {
  const a = `test-a-${Date.now()}`
  const b = `test-b-${Date.now()}`
  assert.equal(rateLimit(a, { limit: 1, windowMs: 60_000 }), true)
  assert.equal(rateLimit(a, { limit: 1, windowMs: 60_000 }), false)
  assert.equal(rateLimit(b, { limit: 1, windowMs: 60_000 }), true)
})
