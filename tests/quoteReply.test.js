import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuoteId, dedupeThreadReplies, quoteReplyKind, conversationPreview, isReceiptBody, parseReceiptLine } from '../lib/quoteReply.js'

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

test('quoteReplyKind distinguishes quote / invoice / receipt by body', () => {
  assert.equal(quoteReplyKind({ quote_id: UUID, body: 'Sent quote QT-1' }), 'quote')
  assert.equal(quoteReplyKind({ quote_id: UUID, body: 'Sent invoice INV-1 …' }), 'invoice')
  assert.equal(quoteReplyKind({ quote_id: UUID, body: 'Sent receipt for INV-1 …' }), 'receipt')
  assert.equal(quoteReplyKind({ quote_id: null, body: 'just a message' }), null)
})

test('conversation preview advances to the latest event (receipt, not quote)', () => {
  const me = 'me-1'
  // freelancer (me) sent the receipt → "Receipt sent"; client sees "received"
  assert.match(conversationPreview({ quote_id: UUID, body: 'Sent receipt for INV-1', sender_user_id: me }, me), /Receipt sent/)
  assert.match(conversationPreview({ quote_id: UUID, body: 'Sent receipt for INV-1', sender_user_id: 'freelancer' }, me), /Receipt received/)
  assert.match(conversationPreview({ quote_id: UUID, body: 'Sent invoice INV-1', sender_user_id: 'freelancer' }, me), /Invoice received/)
})

test('conversation preview shows plain replies with a You: prefix when own', () => {
  const me = 'me-1'
  assert.equal(conversationPreview({ body: 'see you monday', sender_user_id: me }, me), 'You: see you monday')
  assert.equal(conversationPreview({ body: 'thanks!', sender_user_id: 'other' }, me), 'thanks!')
  assert.equal(conversationPreview(null, me), null)
})

test('isReceiptBody detects receipt lines', () => {
  assert.equal(isReceiptBody('Sent receipt for INV-1 — paid in full on 14 Jun 2026. Total $250.00'), true)
  assert.equal(isReceiptBody('Sent quote QT-1'), false)
  assert.equal(isReceiptBody('Sent invoice INV-1 …'), false)
  assert.equal(isReceiptBody(null), false)
})

test('parseReceiptLine extracts ref, paid date and total from a legacy line', () => {
  const info = parseReceiptLine('Sent receipt for INV-20260613-475 — paid in full on 13 June 2026. Total $250.00')
  assert.deepEqual(info, { ref: 'INV-20260613-475', paidOn: '13 June 2026', total: '250.00' })
})

test('parseReceiptLine degrades gracefully for unparseable receipt text', () => {
  // Still a receipt line, but not the canonical format → blank fields, not null
  assert.deepEqual(parseReceiptLine('Sent receipt (older format)'), { ref: null, paidOn: null, total: null })
  // Not a receipt at all
  assert.equal(parseReceiptLine('hello there'), null)
})
