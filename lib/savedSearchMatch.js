// Pure predicate: does a freelancer match a saved search?
// Used by /api/match-saved-searches and unit-tested in isolation so the
// alert logic can't silently drift. Category/location only narrow when BOTH
// sides have a value (a freelancer with no category still matches a
// category search — lenient by design); a keyword must appear in the
// freelancer's name, trade or skills.
export function matchesSavedSearch(freelancer, search) {
  if (!freelancer || !search) return false
  if (search.category && freelancer.category && search.category !== freelancer.category) return false
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
