import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuoteId } from '../lib/quoteReply.js'

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
