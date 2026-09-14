// Money on documents. Quotes default to BBD, which Barbados writes as Bds$.
// Lives apart from organisations.js so the document template (and its
// tests) can import it without pulling in the Supabase client.
export function currencySymbol(code) {
  if (!code || code === 'BBD') return 'Bds$'
  if (code === 'USD') return 'US$'
  return code + ' '
}
