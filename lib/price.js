/**
 * Parse a price that may be stored as a number or a formatted string
 * ("$250", "From 100", "250+"). Returns a number, or null when no
 * numeric value can be extracted.
 *
 * Every place in the app that needs a numeric price should go through
 * this so sorting, cart totals and quote items all agree.
 */
export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? null : n
}
