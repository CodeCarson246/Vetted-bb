/**
 * The trades to offer as one-tap searches on the homepage, worked out from
 * the professionals actually listed.
 *
 * These used to be a hardcoded list written before anyone had signed up, so
 * five of the six led to an empty results page. Deriving them from live rows
 * means every chip returns at least the person it came from, and the row
 * keeps itself current as the marketplace fills out.
 *
 * Trades are free text typed by each professional, so they are grouped
 * case-insensitively and shown in title case.
 */

const MAX_LABEL_CHARS = 28

function titleCase(s) {
  return s.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

export function popularTrades(rows, limit = 6) {
  const groups = new Map()

  for (const row of rows || []) {
    const raw = typeof row?.trade === 'string' ? row.trade.replace(/\s+/g, ' ').trim() : ''
    if (!raw || raw.length > MAX_LABEL_CHARS) continue
    const key = raw.toLowerCase()
    const existing = groups.get(key)
    if (existing) existing.count++
    else groups.set(key, { label: titleCase(raw), query: key, count: 1 })
  }

  return [...groups.values()]
    // Most-represented trade first; alphabetical between ties so the row
    // doesn't reshuffle on every load while everyone has one professional.
    .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
    .slice(0, limit)
}
