import test from 'node:test'
import assert from 'node:assert/strict'
import { popularTrades } from '../lib/popularTrades.js'

test('the busiest trade leads, ties sort alphabetically', () => {
  const rows = [
    { trade: 'Landscaper' },
    { trade: 'Plumber' },
    { trade: 'Landscaper' },
    { trade: 'Electrician' },
  ]
  assert.deepEqual(popularTrades(rows).map(t => t.label), ['Landscaper', 'Electrician', 'Plumber'])
  assert.equal(popularTrades(rows)[0].count, 2)
})

test('trades are grouped case-insensitively and shown in title case', () => {
  const rows = [{ trade: 'CLEANING SERVICES' }, { trade: 'cleaning services' }, { trade: '  Cleaning   Services ' }]
  const [only] = popularTrades(rows)
  assert.equal(popularTrades(rows).length, 1)
  assert.equal(only.label, 'Cleaning Services')
  assert.equal(only.query, 'cleaning services')
  assert.equal(only.count, 3)
})

test('blank, missing and over-long trades are skipped', () => {
  const rows = [
    { trade: '' },
    { trade: '   ' },
    { trade: null },
    {},
    { trade: 'I do absolutely everything you could ever need' },
    { trade: 'Plumber' },
  ]
  assert.deepEqual(popularTrades(rows).map(t => t.label), ['Plumber'])
})

test('the row is capped, and empty input gives an empty row', () => {
  const rows = ['Plumber', 'Electrician', 'Mason', 'Painter', 'Roofer', 'Welder', 'Tiler'].map(trade => ({ trade }))
  assert.equal(popularTrades(rows).length, 6)
  assert.equal(popularTrades(rows, 3).length, 3)
  assert.deepEqual(popularTrades([]), [])
  assert.deepEqual(popularTrades(null), [])
})
