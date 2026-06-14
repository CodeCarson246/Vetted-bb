import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuoteId, dedupeThreadReplies } from '../lib/quoteReply.js'

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

test('prefers the quote_id column', () => {
  assert.equal(getQuoteId({ quote_id: UUID, body: 'Sent quote QT-1' }), UUID)
})

test('falls back to the legacy __QUOTE__ body sentinel', () => {
  assert.equal(getQuoteId({ quote_id: null, body: `__QUOTE__${UUID}` }), UUID)
})

test('plain replies are not quotes', () => {
  assert.equal(getQuoteId({ quote_id: null, body: 'Thanks, see you Monday' }), null)
  assert.equal(getQuoteId({ body: '' }), null)
  assert.equal(getQuoteId(null), null)
})

test('a user typing the sentinel mid-message is not a quote', () => {
  assert.equal(getQuoteId({ quote_id: null, body: 'what does __QUOTE__ mean?' }), null)
})

test('collapses several rows of the same quote_number to one card', () => {
  // A double-submitted quote: 4 distinct quote rows + reply rows that all
  // share quote_number QT-391 → must render once.
  const quotes = {
    q1: { quote_number: 'QT-391' },
    q2: { quote_number: 'QT-391' },
    q3: { quote_number: 'QT-391' },
    q4: { quote_number: 'QT-391' },
  }
  const replies = [1, 2, 3, 4].map(n => ({ id: n, quote_id: `q${n}`, body: 'Sent quote QT-391' }))
  const out = dedupeThreadReplies(replies, quotes)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 1) // earliest kept
})

test('keeps the quote, its invoice and its receipt as distinct cards', () => {
  const quotes = { q1: { quote_number: 'QT-1', invoice_number: 'INV-1', paid_at: '2026-06-14T16:00:00Z' } }
  const replies = [
    { id: 1, quote_id: 'q1', body: 'Sent quote QT-1' },
    { id: 2, quote_id: 'q1', body: 'Sent invoice INV-1 — payment due …' },
    { id: 3, quote_id: 'q1', body: 'Sent receipt for INV-1 — paid in full …' },
  ]
  assert.equal(dedupeThreadReplies(replies, quotes).length, 3)
})

test('drops literal duplicate reply rows by id', () => {
  const replies = [{ id: 7, body: 'hi' }, { id: 7, body: 'hi' }]
  assert.equal(dedupeThreadReplies(replies, {}).length, 1)
})

test('preserves all plain (non-quote) replies', () => {
  const replies = [{ id: 1, body: 'hello' }, { id: 2, body: 'world' }]
  assert.equal(dedupeThreadReplies(replies, {}).length, 2)
})
