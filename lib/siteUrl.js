// Canonical public origin for absolute links: share URLs, sitemap, robots,
// canonical + Open Graph tags, auth redirects and email links.
//
// Set NEXT_PUBLIC_SITE_URL in the environment:
//   production (Vercel): https://vetted.bb
//   local dev (.env.local): http://localhost:3000
// Falls back to the production domain when unset.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vetted.bb'

// Host without the scheme, for display (e.g. "vetted.bb/freelancers/…").
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '')
