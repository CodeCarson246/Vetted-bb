// Pure predicate: does a freelancer match a saved search?
// Used by /api/match-saved-searches and unit-tested in isolation so the
// alert logic can't silently drift. Category/location only narrow when BOTH
// sides have a value (a freelancer with no category still matches a
// category search — lenient by design); a keyword must appear in the
// freelancer's name, trade or skills.
export function matchesSavedSearch(freelancer, search) {
  if (!freelancer || !search) return false
  // A freelancer matches on their primary category OR any extra category
  // (multi-venture profiles), staying lenient when either side is unset.
  const cats = [freelancer.category, ...(Array.isArray(freelancer.extra_categories) ? freelancer.extra_categories : [])].filter(Boolean)
  if (search.category && cats.length > 0 && !cats.includes(search.category)) return false
  if (search.location && freelancer.location && search.location !== freelancer.location) return false
  const q = (search.query || '').trim().toLowerCase()
  if (q) {
    const haystack = [
      freelancer.name,
      freelancer.trade,
      ...(Array.isArray(freelancer.skills) ? freelancer.skills : []),
    ].filter(Boolean).join(' ').toLowerCase()
    if (!haystack.includes(q)) return false
  }
  return true
}
