import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesSavedSearch } from '../lib/savedSearchMatch.js'

const plumber = { name: 'Joe Bloggs', trade: 'Plumber', category: 'Trades & Construction', location: 'Saint Michael', skills: ['leak repair', 'boilers'] }

test('empty search matches anyone', () => {
  assert.equal(matchesSavedSearch(plumber, {}), true)
})

test('category must match when both set', () => {
  assert.equal(matchesSavedSearch(plumber, { category: 'Trades & Construction' }), true)
  assert.equal(matchesSavedSearch(plumber, { category: 'Beauty & Wellness' }), false)
})

test('location must match when both set', () => {
  assert.equal(matchesSavedSearch(plumber, { location: 'Saint Michael' }), true)
  assert.equal(matchesSavedSearch(plumber, { location: 'Christ Church' }), false)
})

test('a freelancer with no category still matches a category search (lenient)', () => {
  assert.equal(matchesSavedSearch({ ...plumber, category: null }, { category: 'Trades & Construction' }), true)
})

test('matches on an extra category too (multi-venture profiles)', () => {
  const multi = { ...plumber, extra_categories: ['Food & Catering'] }
  assert.equal(matchesSavedSearch(multi, { category: 'Trades & Construction' }), true, 'primary still matches')
  assert.equal(matchesSavedSearch(multi, { category: 'Food & Catering' }), true, 'extra category matches')
  assert.equal(matchesSavedSearch(multi, { category: 'Automotive' }), false, 'unrelated category does not')
})

test('extra_categories alone can match when there is no primary', () => {
  const noPrimary = { ...plumber, category: null, extra_categories: ['Food & Catering'] }
  assert.equal(matchesSavedSearch(noPrimary, { category: 'Food & Catering' }), true)
  assert.equal(matchesSavedSearch(noPrimary, { category: 'Automotive' }), false)
})

test('keyword matches name, trade or skills (case-insensitive)', () => {
  assert.equal(matchesSavedSearch(plumber, { query: 'plumber' }), true)
  assert.equal(matchesSavedSearch(plumber, { query: 'LEAK' }), true)
  assert.equal(matchesSavedSearch(plumber, { query: 'bloggs' }), true)
  assert.equal(matchesSavedSearch(plumber, { query: 'electrician' }), false)
})

test('all conditions must hold together', () => {
  assert.equal(matchesSavedSearch(plumber, { query: 'plumber', category: 'Trades & Construction', location: 'Saint Michael' }), true)
  assert.equal(matchesSavedSearch(plumber, { query: 'plumber', location: 'Christ Church' }), false)
})

test('null inputs are safe', () => {
  assert.equal(matchesSavedSearch(null, {}), false)
  assert.equal(matchesSavedSearch(plumber, null), false)
})
