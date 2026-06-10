import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePrice } from '../lib/price.js'

test('parses plain numbers', () => {
  assert.equal(parsePrice(250), 250)
  assert.equal(parsePrice(99.5), 99.5)
  assert.equal(parsePrice(0), 0)
})

test('parses numeric strings', () => {
  assert.equal(parsePrice('250'), 250)
  assert.equal(parsePrice('99.50'), 99.5)
})

test('parses formatted strings that broke parseInt', () => {
  assert.equal(parsePrice('$250'), 250)
  assert.equal(parsePrice('From 100'), 100)
  assert.equal(parsePrice('250+'), 250)
  assert.equal(parsePrice('BBD $1,500'), 1500)
})

test('returns null for unparseable values', () => {
  assert.equal(parsePrice(''), null)
  assert.equal(parsePrice('contact us'), null)
  assert.equal(parsePrice(null), null)
  assert.equal(parsePrice(undefined), null)
  assert.equal(parsePrice(NaN), null)
  assert.equal(parsePrice(Infinity), null)
})
