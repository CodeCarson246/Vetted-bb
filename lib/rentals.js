import { parsePrice } from './price.js'

/**
 * Rentals and stays: things one customer has at a time, for a run of days.
 *
 * A car, a villa, a marquee, a boat. They differ from every other service on
 * the site in three ways, and this file is the single place those rules live
 * so the profile, the booking API, the calendar and the quote all agree:
 *
 *  1. They are booked for a RANGE of dates, not a day or a time slot.
 *  2. A confirmed booking takes THAT ITEM off the market for those dates
 *     (a tradesperson can run three jobs at once; a Suzuki Swift cannot).
 *  3. They are priced per day or per night, and the owner may set a discount
 *     for longer rentals that is applied automatically.
 *
 * Dates are 'YYYY-MM-DD' keys throughout and all arithmetic is done in UTC,
 * so nothing shifts by a day depending on where the server or phone is.
 *
 * Two ways of counting, because that is how the two trades talk:
 *  - 'day'   first day and last day, both included. Mon to Wed is 3 days and
 *            the car is out on all three.
 *  - 'night' check-in and check-out. Mon to Wed is 2 nights, and Wednesday
 *            is free for the next guest to arrive.
 * Internally a booking is always stored as the range of OCCUPIED days (see
 * occupiedRange), so one overlap test serves both.
 */

export const RENTAL_UNITS = ['day', 'night']
export const MAX_RENTAL_UNITS = 365
export const MAX_DISCOUNT_TIERS = 4

const DAY_MS = 86400000
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return false
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

function toMs(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(key, n) {
  return new Date(toMs(key) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from a to b (b - a). Negative when b is earlier. */
export function daysBetween(a, b) {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS)
}

/** Today's date in Barbados (UTC-4, no daylight saving). */
export function todayKeyBarbados(now = Date.now()) {
  return new Date(now - 4 * 3600000).toISOString().slice(0, 10)
}

export function unitLabel(unit, n = 1) {
  const word = unit === 'night' ? 'night' : 'day'
  return n === 1 ? word : `${word}s`
}

export function perLabel(unit) {
  return unit === 'night' ? 'per night' : 'per day'
}

/** 'Sat 12 Dec' */
export function fmtDay(key) {
  if (!isDateKey(key)) return ''
  return new Date(toMs(key)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/**
 * How many days or nights the customer is paying for, given the two dates
 * THEY picked (first/last day, or check-in/check-out). 0 means not a valid
 * selection.
 */
export function rentalUnits(unit, start, end) {
  if (!isDateKey(start) || !isDateKey(end)) return 0
  const diff = daysBetween(start, end)
  const n = unit === 'night' ? diff : diff + 1
  return n >= 1 && n <= MAX_RENTAL_UNITS ? n : 0
}

/**
 * The days the item is actually taken, both ends included. For nights the
 * check-out day is not occupied, so it is left off.
 */
export function occupiedRange(unit, start, end) {
  return { start, end: unit === 'night' ? addDays(end, -1) : end }
}

/** The reverse: the customer-facing second date for a stored occupied range. */
export function customerEnd(unit, occupiedEnd) {
  return unit === 'night' ? addDays(occupiedEnd, 1) : occupiedEnd
}

/** Do two inclusive date ranges share at least one day? */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd
}

/** True when an occupied range touches none of the taken ranges. */
export function isRangeFree(start, end, taken = []) {
  return !(taken || []).some(t => rangesOverlap(start, end, t.start, t.end))
}

/** Every individual taken day, for greying out a calendar. */
export function takenDaySet(taken = []) {
  const set = new Set()
  for (const t of taken || []) {
    if (!isDateKey(t?.start) || !isDateKey(t?.end) || t.end < t.start) continue
    const span = Math.min(daysBetween(t.start, t.end), 2 * MAX_RENTAL_UNITS)
    for (let i = 0; i <= span; i++) set.add(addDays(t.start, i))
  }
  return set
}

/**
 * Is the item out right now, and if so when is it back? Back-to-back
 * bookings are followed through, so "Booked until" is the first day it is
 * genuinely free.
 */
export function rentalStatusOn(taken = [], dayKey) {
  const days = takenDaySet(taken)
  if (!days.has(dayKey)) return { available: true, freeFrom: dayKey }
  let d = dayKey
  for (let i = 0; i < 2 * MAX_RENTAL_UNITS && days.has(d); i++) d = addDays(d, 1)
  return { available: false, freeFrom: d }
}

/**
 * Tidy whatever the owner typed into the discount editor: whole-number
 * lengths of 2 or more, 1-90 percent, one tier per length, shortest first.
 * Always safe to call on missing or malformed data.
 */
export function normaliseDiscounts(list) {
  const byMin = new Map()
  for (const row of Array.isArray(list) ? list : []) {
    const min = Math.floor(Number(row?.min))
    const percent = Math.round(Number(row?.percent) * 100) / 100
    if (!Number.isFinite(min) || !Number.isFinite(percent)) continue
    if (min < 2 || min > MAX_RENTAL_UNITS || percent <= 0 || percent > 90) continue
    byMin.set(min, Math.max(byMin.get(min) || 0, percent))
  }
  return [...byMin.entries()]
    .map(([min, percent]) => ({ min, percent }))
    .sort((a, b) => a.min - b.min)
    .slice(0, MAX_DISCOUNT_TIERS)
}

/**
 * The discount a rental of this length earns: the best percentage among the
 * tiers it qualifies for, so a longer rental is never offered a worse deal
 * than a shorter one. null when none applies.
 */
export function bestDiscount(discounts, units) {
  let best = null
  for (const tier of normaliseDiscounts(discounts)) {
    if (units >= tier.min && (!best || tier.percent > best.percent)) best = tier
  }
  return best
}

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Price a rental. The discount is folded into the unit price (rounded to the
 * cent) and the total is units x that price, so the figure the customer sees
 * on the profile is exactly the figure on the quote line: nothing is
 * recomputed differently downstream, and no document ever needs a negative
 * line. Returns null when the service or the dates cannot be priced.
 */
export function priceRental(service, start, end) {
  const unit = service?.price_unit === 'night' ? 'night' : 'day'
  const rate = parsePrice(service?.price)
  const units = rentalUnits(unit, start, end)
  if (rate === null || rate <= 0 || units === 0) return null
  const tier = bestDiscount(service?.length_discounts, units)
  const unitPrice = tier ? round2(rate * (1 - tier.percent / 100)) : round2(rate)
  const total = round2(units * unitPrice)
  const fullTotal = round2(units * rate)
  return {
    unit, units, rate: round2(rate),
    discountPct: tier ? tier.percent : 0,
    discountMin: tier ? tier.min : 0,
    unitPrice, total, fullTotal,
    saving: round2(fullTotal - total),
  }
}

/**
 * One line of a booking-request message, in a form the inbox can turn back
 * into a quote line with a single tap:
 *   • Suzuki Swift, 7 days, Sat 12 Dec to Fri 18 Dec (10% off for 7+ days): 7 x $108.00
 * The name is flattened of colons so the line stays parseable.
 */
export function rentalEnquiryLine(name, start, end, pricing) {
  const label = String(name || 'Rental').replace(/[:\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
  const off = pricing.discountPct
    ? ` (${pricing.discountPct}% off for ${pricing.discountMin}+ ${unitLabel(pricing.unit, 2)})`
    : ''
  return `• ${label}, ${pricing.units} ${unitLabel(pricing.unit, pricing.units)}, ${fmtDay(start)} to ${fmtDay(end)}${off}: ${pricing.units} x $${pricing.unitPrice.toFixed(2)}`
}

/** Reads a line written by rentalEnquiryLine. null for anything else. */
export function parseRentalLine(line) {
  const m = String(line || '').match(/^\s*[•\-*]\s*(.+?):\s*(\d{1,3})\s*x\s*\$?([\d,]+(?:\.\d{1,2})?)\s*$/)
  if (!m) return null
  const qty = Number(m[2])
  const price = parsePrice(m[3])
  if (!qty || price === null) return null
  return { description: m[1].trim(), qty, price }
}
