import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isDateKey, addDays, daysBetween, todayKeyBarbados, rentalUnits, occupiedRange, customerEnd,
  rangesOverlap, isRangeFree, takenDaySet, rentalStatusOn, normaliseDiscounts, bestDiscount,
  priceRental, rentalEnquiryLine, parseRentalLine, unitLabel, fmtDay,
} from '../lib/rentals.js'

const swift = { name: 'Suzuki Swift', price: '120', price_unit: 'day', length_discounts: [{ min: 7, percent: 10 }, { min: 28, percent: 25 }] }
const villa = { name: 'Seaview apartment', price: '300.00', price_unit: 'night', length_discounts: [] }

test('date keys are validated and never shift across a month or year end', () => {
  assert.equal(isDateKey('2026-12-31'), true)
  assert.equal(isDateKey('2026-02-30'), false)
  assert.equal(isDateKey('12/31/2026'), false)
  assert.equal(isDateKey(null), false)
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3)
})

test('today in Barbados stays on the local date late in the evening', () => {
  // 01:30 UTC on the 13th is 21:30 on the 12th in Barbados.
  assert.equal(todayKeyBarbados(Date.UTC(2026, 11, 13, 1, 30)), '2026-12-12')
  assert.equal(todayKeyBarbados(Date.UTC(2026, 11, 13, 4, 0)), '2026-12-13')
})

test('days count both ends; nights count the nights between', () => {
  assert.equal(rentalUnits('day', '2026-12-14', '2026-12-16'), 3)   // Mon, Tue, Wed
  assert.equal(rentalUnits('day', '2026-12-14', '2026-12-14'), 1)   // same-day hire
  assert.equal(rentalUnits('night', '2026-12-14', '2026-12-16'), 2) // two nights
  assert.equal(rentalUnits('night', '2026-12-14', '2026-12-14'), 0) // no night at all
  assert.equal(rentalUnits('day', '2026-12-16', '2026-12-14'), 0)   // backwards
  assert.equal(rentalUnits('day', '2026-01-01', '2028-01-01'), 0)   // over a year
  assert.equal(rentalUnits('day', 'soon', '2026-12-14'), 0)
})

test('a stay frees its check-out day for the next guest; a car hire does not', () => {
  assert.deepEqual(occupiedRange('night', '2026-12-14', '2026-12-16'), { start: '2026-12-14', end: '2026-12-15' })
  assert.deepEqual(occupiedRange('day', '2026-12-14', '2026-12-16'), { start: '2026-12-14', end: '2026-12-16' })
  assert.equal(customerEnd('night', '2026-12-15'), '2026-12-16')
  assert.equal(customerEnd('day', '2026-12-16'), '2026-12-16')

  // Guest A checks out on the 16th; guest B may check in on the 16th.
  const a = occupiedRange('night', '2026-12-14', '2026-12-16')
  const b = occupiedRange('night', '2026-12-16', '2026-12-18')
  assert.equal(rangesOverlap(a.start, a.end, b.start, b.end), false)
  // The same dates for a car DO collide: it is out on the 16th.
  const c = occupiedRange('day', '2026-12-14', '2026-12-16')
  const d = occupiedRange('day', '2026-12-16', '2026-12-18')
  assert.equal(rangesOverlap(c.start, c.end, d.start, d.end), true)
})

test('availability: free only when no taken range is touched', () => {
  const taken = [{ start: '2026-12-10', end: '2026-12-12' }, { start: '2026-12-20', end: '2026-12-20' }]
  assert.equal(isRangeFree('2026-12-13', '2026-12-19', taken), true)
  assert.equal(isRangeFree('2026-12-12', '2026-12-14', taken), false)
  assert.equal(isRangeFree('2026-12-01', '2026-12-31', taken), false)
  assert.equal(isRangeFree('2026-12-13', '2026-12-19', null), true)
  assert.deepEqual([...takenDaySet(taken)].sort(), ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-20'])
})

test('"booked until" follows back-to-back bookings to the first free day', () => {
  const taken = [{ start: '2026-12-10', end: '2026-12-12' }, { start: '2026-12-13', end: '2026-12-15' }]
  assert.deepEqual(rentalStatusOn(taken, '2026-12-11'), { available: false, freeFrom: '2026-12-16' })
  assert.deepEqual(rentalStatusOn(taken, '2026-12-09'), { available: true, freeFrom: '2026-12-09' })
  assert.deepEqual(rentalStatusOn([], '2026-12-09'), { available: true, freeFrom: '2026-12-09' })
})

test('discount tiers are cleaned up however they were typed', () => {
  assert.deepEqual(
    normaliseDiscounts([{ min: '28', percent: '25' }, { min: 7, percent: 10 }, { min: 7, percent: 12 }, { min: 1, percent: 50 }, { min: 5, percent: 0 }, { min: 9, percent: 120 }, null, { min: 'x' }]),
    [{ min: 7, percent: 12 }, { min: 28, percent: 25 }],
  )
  assert.deepEqual(normaliseDiscounts(undefined), [])
  assert.deepEqual(normaliseDiscounts('nonsense'), [])
  assert.equal(normaliseDiscounts(Array.from({ length: 9 }, (_, i) => ({ min: i + 2, percent: 5 }))).length, 4)
})

test('a longer rental never gets a worse deal than a shorter one', () => {
  assert.equal(bestDiscount(swift.length_discounts, 6), null)
  assert.deepEqual(bestDiscount(swift.length_discounts, 7), { min: 7, percent: 10 })
  assert.deepEqual(bestDiscount(swift.length_discounts, 30), { min: 28, percent: 25 })
  // Tiers entered the wrong way round: 14+ days must not drop back to 5%.
  assert.deepEqual(bestDiscount([{ min: 7, percent: 15 }, { min: 14, percent: 5 }], 20), { min: 7, percent: 15 })
})

test('pricing: no discount below the first tier', () => {
  assert.deepEqual(priceRental(swift, '2026-12-14', '2026-12-16'), {
    unit: 'day', units: 3, rate: 120, discountPct: 0, discountMin: 0,
    unitPrice: 120, total: 360, fullTotal: 360, saving: 0,
  })
})

test('pricing: the discount applies automatically once the length qualifies', () => {
  const week = priceRental(swift, '2026-12-14', '2026-12-20') // 7 days
  assert.equal(week.units, 7)
  assert.equal(week.discountPct, 10)
  assert.equal(week.unitPrice, 108)
  assert.equal(week.total, 756)
  assert.equal(week.saving, 84)
  const month = priceRental(swift, '2026-12-01', '2026-12-30') // 30 days
  assert.equal(month.discountPct, 25)
  assert.equal(month.total, 2700)
})

test('pricing: nights, cents, and a total that always equals units x unit price', () => {
  const stay = priceRental(villa, '2026-12-14', '2026-12-17')
  assert.equal(stay.units, 3)
  assert.equal(stay.total, 900)
  // 85 a night with 15% off is 72.25; nine nights is 650.25 exactly.
  const odd = priceRental({ price: '85', price_unit: 'night', length_discounts: [{ min: 7, percent: 15 }] }, '2026-12-01', '2026-12-10')
  assert.equal(odd.unitPrice, 72.25)
  assert.equal(odd.total, 650.25)
  // A rate that does not divide cleanly still reconciles on the quote line.
  const thirds = priceRental({ price: '100', price_unit: 'day', length_discounts: [{ min: 3, percent: 33.33 }] }, '2026-12-01', '2026-12-03')
  assert.equal(thirds.unitPrice, 66.67)
  assert.equal(thirds.total, 200.01)
  assert.equal(Math.round(thirds.units * thirds.unitPrice * 100) / 100, thirds.total)
})

test('pricing refuses what it cannot price', () => {
  assert.equal(priceRental({ price: '0', price_unit: 'day' }, '2026-12-14', '2026-12-16'), null)
  assert.equal(priceRental({ price: '', price_unit: 'day' }, '2026-12-14', '2026-12-16'), null)
  assert.equal(priceRental(swift, '2026-12-16', '2026-12-14'), null)
  assert.equal(priceRental(null, '2026-12-14', '2026-12-16'), null)
})

test('a booking-request line survives the trip to the inbox and back', () => {
  const p = priceRental(swift, '2026-12-14', '2026-12-20')
  const line = rentalEnquiryLine('Suzuki Swift', '2026-12-14', '2026-12-20', p)
  assert.equal(line, '• Suzuki Swift, 7 days, Mon 14 Dec to Sun 20 Dec (10% off for 7+ days): 7 x $108.00')
  assert.deepEqual(parseRentalLine(line), {
    description: 'Suzuki Swift, 7 days, Mon 14 Dec to Sun 20 Dec (10% off for 7+ days)', qty: 7, price: 108,
  })
  // qty x price on the quote is the total the customer was shown.
  const parsed = parseRentalLine(line)
  assert.equal(parsed.qty * parsed.price, p.total)

  const plain = rentalEnquiryLine('Family van: 8 seats', '2026-12-14', '2026-12-14', priceRental({ price: '1,250.50', price_unit: 'day' }, '2026-12-14', '2026-12-14'))
  assert.equal(plain, '• Family van 8 seats, 1 day, Mon 14 Dec to Mon 14 Dec: 1 x $1250.50')
  assert.deepEqual(parseRentalLine(plain), { description: 'Family van 8 seats, 1 day, Mon 14 Dec to Mon 14 Dec', qty: 1, price: 1250.5 })
})

test('ordinary enquiry lines are not mistaken for rentals', () => {
  assert.equal(parseRentalLine('• Lawn maintenance: $50.00'), null)
  assert.equal(parseRentalLine('Can I get it for 3 x $100?'), null)
  assert.equal(parseRentalLine(''), null)
  assert.equal(parseRentalLine(null), null)
})

test('labels', () => {
  assert.equal(unitLabel('day', 1), 'day')
  assert.equal(unitLabel('day', 3), 'days')
  assert.equal(unitLabel('night', 1), 'night')
  assert.equal(unitLabel('night', 2), 'nights')
  assert.equal(fmtDay('2026-12-14'), 'Mon 14 Dec')
  assert.equal(fmtDay('nope'), '')
})
