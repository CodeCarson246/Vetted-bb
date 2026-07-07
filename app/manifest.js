// Served at /manifest.webmanifest — makes the site installable on
// phones ("Add to Home Screen"), per Phase 2 of the roadmap.
export default function manifest() {
  return {
    name: 'Vetted.bb: Trusted Professionals in Barbados',
    short_name: 'Vetted.bb',
    description:
      'Find trusted, reviewed freelancers across Barbados. Real reviews. Real accountability.',
    start_url: '/',
    display: 'standalone',
    background_color: '#00267F',
    theme_color: '#00267F',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Art scaled into the safe-zone circle so round Android masks
        // don't clip the wordmark
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
