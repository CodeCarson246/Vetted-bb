// Multi-line address blocks as printed on quotes and invoices. Its own module
// (no Supabase import) so the server can build a document with it too.
export function formatAddressBlock(a) {
  if (!a) return ''
  return [a.address_line1, a.address_line2, a.city_town, a.parish, a.country]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join('\n')
}
