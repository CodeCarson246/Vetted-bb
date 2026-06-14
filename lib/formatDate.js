// Single source of truth for rendering quote / invoice / receipt dates.
//
// Quote dates (quote_date, due_date, invoice_due_date) are stored as
// DATE-only strings ('2026-06-14'). new Date('2026-06-14') parses as UTC
// midnight, so in a UTC-4 zone (Barbados) it renders as the PREVIOUS day —
// an off-by-one. Pinning date-only values to local noon keeps the calendar
// day stable in every timezone. Full timestamps (invoiced_at, paid_at)
// already carry a time and pass straight through.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function formatDocDate(
  value,
  opts = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-GB',
) {
  if (!value) return ''
  const normalized = DATE_ONLY.test(value) ? `${value}T12:00:00` : value
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, opts)
}
