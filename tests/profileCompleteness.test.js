import test from 'node:test'
import assert from 'node:assert/strict'
import { fillStarter } from '../lib/bioStarters.js'
import {
  profileRequirements, isProfileComplete, missingRequirements,
  completionPercent, isPricedService, MIN_BIO_CHARS,
} from '../lib/profileCompleteness.js'

const full = {
  name: 'Jeremy Foster',
  trade: 'Landscaper',
  category: 'Landscaping & Outdoors',
  location: 'christ church',
  bio: 'A few years of experience in landscaping, specialising in lawn maintenance and tree trimming.',
}
const services = [{ price: '50.00', price_type: 'starting_from' }]

test('a profile with all six is complete', () => {
  assert.equal(isProfileComplete(full, services), true)
  assert.equal(completionPercent(full, services), 100)
  assert.deepEqual(missingRequirements(full, services), [])
})

test('a free service alone does not count as a price', () => {
  assert.equal(isPricedService({ price: '0.00' }), false)
  assert.equal(isPricedService({ price: '' }), false)
  assert.equal(isPricedService({ price: 'Bds$50' }), true)
  // The real case: a free site visit listed and nothing else.
  assert.equal(isProfileComplete(full, [{ price: '0', price_type: 'fixed' }]), false)
  assert.deepEqual(missingRequirements(full, [{ price: '0' }]).map(r => r.key), ['service'])
})

test('a bio has to say something', () => {
  assert.equal(isProfileComplete({ ...full, bio: 'cut grass' }, services), false)
  assert.equal(isProfileComplete({ ...full, bio: 'x'.repeat(MIN_BIO_CHARS) }, services), true)
  // Whitespace is not content.
  assert.equal(isProfileComplete({ ...full, bio: ' '.repeat(80) }, services), false)
})

test('the empty profiles that prompted this report every item', () => {
  // Warren: name and trade only, no category, parish, bio or services.
  const warren = { name: 'Warren Scantlebury', trade: 'Software Engineering' }
  assert.deepEqual(
    missingRequirements(warren, []).map(r => r.key),
    ['category', 'location', 'bio', 'service'],
  )
  assert.equal(completionPercent(warren, []), 33)
  assert.equal(isProfileComplete(warren, []), false)
})

test('every requirement carries copy for the banner', () => {
  for (const r of profileRequirements({}, [])) {
    assert.ok(r.label && r.hint, r.key)
    assert.equal(typeof r.done, 'boolean')
  }
})

test('missing and null inputs are safe', () => {
  assert.equal(isProfileComplete(null), false)
  assert.equal(isProfileComplete(undefined, undefined), false)
  assert.equal(completionPercent(null, null), 0)
})

// The bio starters live in the setup component but the grammar is worth
// pinning: "an electrician" reads as care, "a electrician" reads as a bug.
test('bio starter picks a or an to match the trade', () => {
  assert.equal(fillStarter('as {a} {trade} in Barbados', 'Electrician'), 'as an electrician in Barbados')
  assert.equal(fillStarter('as {a} {trade} in Barbados', 'Plumber'), 'as a plumber in Barbados')
  assert.equal(fillStarter('as {a} {trade} in Barbados', 'Interior Decorator'), 'as an interior decorator in Barbados')
  assert.equal(fillStarter('as {a} {trade}', ''), 'as a professional')
  assert.equal(fillStarter('as {a} {trade}', null), 'as a professional')
})
