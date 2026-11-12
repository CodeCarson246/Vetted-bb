import test from 'node:test'
import assert from 'node:assert/strict'
import { quoteNumberFor, rentalQuoteValidUntil, rentalQuoteContent, RENTAL_QUOTE_TERMS } from '../lib/rentalQuote.js'
import { priceRental } from '../lib/rentals.js'
import { invoiceDueDate } from '../lib/invoicing.js'

const swift = { name: 'Suzuki Swift', price: '75', price_unit: 'day', length_discounts: [{ min: 7, percent: 10 }] }
const villa = { name: 'Seaview apartment', price: '300', price_unit: 'night', length_discounts: [] }
// appointments.rental is stored as { ...pricing, start, end } by /api/request-booking
const snapshot = (svc, start, end) => ({ ...priceRental(svc, start, end), start, end })

test('the quote is for exactly what the customer was shown', () => {
  // The booking in the screenshot: Fri 13 Nov to Sun 15 Nov, 3 days at Bds$75.
  const q = rentalQuoteContent('Suzuki Swift', snapshot(swift, '2026-11-13', '2026-11-15'))
  assert.deepEqual(q.items, [{ description: 'Suzuki Swift, 3 days, Fri 13 Nov to Sun 15 Nov', qty: 3, price: 75 }])
  assert.equal(q.total, 225)
  assert.equal(q.notes, 'First day Fri 13 Nov, last day Sun 15 Nov (3 days).')
})

test('a length discount is carried into the quote line and the total', () => {
  const q = rentalQuoteContent('Suzuki Swift', snapshot(swift, '2026-12-14', '2026-12-20'))
  assert.deepEqual(q.items, [{ description: 'Suzuki Swift, 7 days, Mon 14 Dec to Sun 20 Dec (10% off for 7+ days)', qty: 7, price: 67.5 }])
  assert.equal(q.total, 472.5)
})

test('nights are quoted check-in to check-out', () => {
  const q = rentalQuoteContent('Seaview apartment', snapshot(villa, '2026-12-01', '2026-12-04'))
  assert.deepEqual(q.items, [{ description: 'Seaview apartment, 3 nights, Tue 1 Dec to Fri 4 Dec', qty: 3, price: 300 }])
  assert.equal(q.total, 900)
  assert.equal(q.notes, 'Check-in Tue 1 Dec, check-out Fri 4 Dec (3 nights).')
})

test('nothing is quoted from a snapshot that cannot be priced', () => {
  assert.equal(rentalQuoteContent('Suzuki Swift', null), null)
  assert.equal(rentalQuoteContent('Suzuki Swift', {}), null)
  assert.equal(rentalQuoteContent('Suzuki Swift', { unit: 'day', units: 3, unitPrice: 0, start: '2026-11-13', end: '2026-11-15' }), null)
  assert.equal(rentalQuoteContent('Suzuki Swift', { unit: 'day', units: 3, unitPrice: 75 }), null)
})

test('a rental quote is due on receipt', () => {
  assert.equal(RENTAL_QUOTE_TERMS, 'due_receipt')
  assert.equal(invoiceDueDate('2026-11-12', RENTAL_QUOTE_TERMS), '2026-11-12')
})

test('the price stands until the rental starts, 30 days at most', () => {
  assert.equal(rentalQuoteValidUntil('2026-11-12', '2026-11-13'), '2026-11-13')
  assert.equal(rentalQuoteValidUntil('2026-11-12', '2027-02-01'), '2026-12-12')
  assert.equal(rentalQuoteValidUntil('2026-11-12', '2026-11-12'), '2026-11-12')
  assert.equal(rentalQuoteValidUntil('2026-11-12', '2026-11-01'), '2026-11-12')
  assert.equal(rentalQuoteValidUntil('2026-11-12', undefined), '2026-11-12')
})

test('quote numbers follow the QT-date-3 digits pattern', () => {
  assert.equal(quoteNumberFor('2026-11-12', 0), 'QT-20261112-100')
  assert.match(quoteNumberFor('2026-11-12'), /^QT-20261112-\d{3}$/)
})
