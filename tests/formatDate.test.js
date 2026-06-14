import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDocDate } from '../lib/formatDate.js'

const SHORT = { day: 'numeric', month: 'short', year: 'numeric' }

test('date-only strings keep their calendar day (no UTC-4 off-by-one)', () => {
  // '2026-06-14' must render as the 14th regardless of the runner timezone —
  // the regression was new Date('2026-06-14') landing on 13 Jun in UTC-4.
  const out = formatDocDate('2026-06-14', SHORT)
  assert.match(out, /14/)
  assert.match(out, /Jun/)
  assert.match(out, /2026/)
})

test('empty / nullish values render as empty string', () => {
  assert.equal(formatDocDate(null), '')
  assert.equal(formatDocDate(undefined), '')
  assert.equal(formatDocDate(''), '')
})

test('invalid dates render as empty string', () => {
  assert.equal(formatDocDate('not-a-date'), '')
})

test('full timestamps pass through and format to a non-empty date', () => {
  const out = formatDocDate('2026-06-14T16:30:00.000Z', SHORT)
  assert.match(out, /2026/)
})
