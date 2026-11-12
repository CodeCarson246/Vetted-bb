// The quote for a rental booking, built from the price the customer was
// shown when they asked for the dates. Pure (no database), so the numbers
// can be tested: the server (lib/serverQuote) only adds who and where.
import { addDays, parseRentalLine, rentalEnquiryLine, unitLabel, fmtDay } from './rentals.js'

// A rental is paid for when it is taken, not a fortnight later.
export const RENTAL_QUOTE_TERMS = 'due_receipt'

export function quoteNumberFor(dateKey, rand = Math.random()) {
  return `QT-${dateKey.replace(/-/g, '')}-${Math.floor(rand * 900) + 100}`
}

// The price stands for 30 days or until the rental starts, whichever comes
// first (but never a date already past).
export function rentalQuoteValidUntil(todayKey, startKey) {
  const cap = addDays(todayKey, 30)
  const start = startKey && startKey > todayKey ? startKey : todayKey
  return start < cap ? start : cap
}

// `snapshot` is appointments.rental: the pricing plus the customer's own
// start and end dates. Returns { items, total, notes } or null when the
// snapshot is not usable (then nothing is sent and the quote is written by
// hand as before).
export function rentalQuoteContent(itemName, snapshot) {
  const s = snapshot || {}
  const units = Number(s.units)
  const unitPrice = Number(s.unitPrice)
  if (!s.start || !s.end || !(units > 0) || !(unitPrice > 0)) return null
  const pricing = { unit: s.unit, units, unitPrice, discountPct: Number(s.discountPct) || 0, discountMin: Number(s.discountMin) || 0 }
  // The same line the customer's request carried, read back the way the
  // inbox reads it, so an automatic quote and a hand-made one say the same.
  const item = parseRentalLine(rentalEnquiryLine(itemName, s.start, s.end, pricing))
  if (!item) return null
  const total = Math.round(item.qty * item.price * 100) / 100
  const night = s.unit === 'night'
  return {
    items: [{ description: item.description, qty: item.qty, price: item.price }],
    total,
    notes: `${night ? 'Check-in' : 'First day'} ${fmtDay(s.start)}, ${night ? 'check-out' : 'last day'} ${fmtDay(s.end)} (${units} ${unitLabel(s.unit, units)}).`,
  }
}
