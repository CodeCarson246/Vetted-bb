import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml } from '../lib/escapeHtml.js'

test('escapes HTML-significant characters', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('xss')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;'
  )
})

test('passes plain text through unchanged', () => {
  assert.equal(escapeHtml('Hi John, the deck looks great.'), 'Hi John, the deck looks great.')
})

test('handles null and undefined', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
})
