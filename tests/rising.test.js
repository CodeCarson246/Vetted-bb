import test from 'node:test'
import assert from 'node:assert/strict'
import { isRising, risingEndsAt, RISING_DAYS } from '../lib/rising.js'

const DAY = 24 * 60 * 60 * 1000
const start = '2026-11-13T12:00:00+00:00'
const t0 = Date.parse(start)

test('the badge lasts 90 days from the day it is given', () => {
  assert.equal(RISING_DAYS, 90)
  assert.equal(isRising({ rising_since: start }, t0), true)
  assert.equal(isRising({ rising_since: start }, t0 + 89 * DAY), true)
  assert.equal(isRising({ rising_since: start }, t0 + 90 * DAY - 1), true)
  assert.equal(isRising({ rising_since: start }, t0 + 90 * DAY), false)
  assert.equal(isRising({ rising_since: start }, t0 + 400 * DAY), false)
})

test('no badge without a start date, or before it', () => {
  for (const f of [null, undefined, {}, { rising_since: null }, { rising_since: '' }, { rising_since: 'soon' }]) {
    assert.equal(isRising(f, t0), false)
  }
  assert.equal(isRising({ rising_since: start }, t0 - DAY), false)
})

test('the end date is 90 days on', () => {
  assert.equal(risingEndsAt({ rising_since: start }).toISOString(), '2027-02-11T12:00:00.000Z')
  assert.equal(risingEndsAt({}), null)
})
