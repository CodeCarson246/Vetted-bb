export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/inbox', '/admin'],
    },
    sitemap: 'https://vetted-bb.vercel.app/sitemap.xml',
  }
}
