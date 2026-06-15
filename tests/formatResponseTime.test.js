import test from 'node:test'
import assert from 'node:assert/strict'
import { formatResponseTime } from '../lib/formatResponseTime.js'

test('minutes under an hour', () => {
  assert.equal(formatResponseTime(5), 'Typically replies within 5 min')
  assert.equal(formatResponseTime(0.4), 'Typically replies within 1 min') // floored to a minimum of 1
})

test('hours', () => {
  assert.equal(formatResponseTime(90), 'Typically replies within 2 hr')
  assert.equal(formatResponseTime(60), 'Typically replies within 1 hr')
})

test('days, with singular/plural', () => {
  assert.equal(formatResponseTime(1440), 'Typically replies within 1 day')
  assert.equal(formatResponseTime(4320), 'Typically replies within 3 days')
})

test('returns null for missing/invalid input', () => {
  assert.equal(formatResponseTime(null), null)
  assert.equal(formatResponseTime(undefined), null)
  assert.equal(formatResponseTime('abc'), null)
})
