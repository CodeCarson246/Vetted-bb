'use client'

function FooterLink({ href, children }) {
  return (
    <a
      href={href}
      style={{
        color: 'rgba(255,255,255,0.6)',
        fontSize: '0.875rem',
        display: 'block',
        marginBottom: '8px',
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'white'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
    >
      {children}
    </a>
  )
}

export default function SiteFooter() {
  const columns = [
    {
      heading: 'For Clients',
      links: [
        { label: 'Browse Professionals', href: '/search' },
        { label: 'How It Works', href: '/#how-it-works' },
        { label: 'All Categories', href: '/search' },
        { label: 'Leave a Review', href: '/dashboard' },
      ],
    },
    {
      heading: 'For Freelancers',
      links: [
        { label: 'Create Profile', href: '/signup?role=freelancer' },
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Quote Builder', href: '/dashboard' },
        { label: 'Get Verified', href: '/dashboard' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Roadmap', href: '/roadmap' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Contact', href: 'mailto:hello@vetted.bb' },
        { label: 'Privacy Policy', href: '/privacy' },
      ],
    },
  ]

  return (
    <footer style={{ backgroundColor: '#001652', color: 'white' }}>
      {/* Top section */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '64px 24px 48px' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div>
            <a href="/" style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '-0.5px',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: '14px',
              lineHeight: 1,
            }}>
              <span style={{ color: 'white' }}>Vetted</span>
              <span style={{ color: '#F9C000' }}>.</span>
              <span style={{ color: 'white' }}>bb</span>
            </a>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', maxWidth: '220px', lineHeight: 1.6, margin: 0 }}>
              Connecting Barbados — a free marketplace for trusted local professionals and the clients who need them.
            </p>
          </div>

          {/* Link columns */}
          {columns.map(col => (
            <div key={col.heading}>
              <p style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '0.875rem',
                color: 'white',
                marginBottom: '16px',
                marginTop: 0,
              }}>
                {col.heading}
              </p>
              {col.links.map(link => (
                <FooterLink key={link.label} href={link.href}>{link.label}</FooterLink>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}
          className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 text-center sm:text-left"
        >
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: 0 }}>
            © 2026 Vetted.bb · Connecting Barbados 🇧🇧
          </p>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="/terms" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >Terms of Service</a>
            <a href="/privacy" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
