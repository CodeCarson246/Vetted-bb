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

/**
 * The lowest price a client could actually be charged, used for the
 * "From Bds$…" figure and the budget filter.
 *
 * Free services are skipped. A free consultation or site visit is a real
 * service worth listing, but "From Bds$0" tells a client nothing about
 * what the work costs. Returns null when there is no paid service.
 */
export function lowestPaidPrice(services) {
  const prices = (services || [])
    .map(s => parsePrice(s?.price))
    .filter(p => p !== null && p > 0)
  return prices.length > 0 ? Math.min(...prices) : null
}
