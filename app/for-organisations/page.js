import Link from 'next/link'
import { SITE_URL } from '@/lib/siteUrl'

const TITLE = 'For organisations: hire verified professionals as a team'
const DESCRIPTION = 'One account for your organisation. Search a pool of verified Barbadian professionals, enquire together, decide together, and keep every quote and invoice in one place.'

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/for-organisations' },
  openGraph: {
    title: `${TITLE} | Vetted.bb`,
    description: DESCRIPTION,
    url: `${SITE_URL}/for-organisations`,
    siteName: 'Vetted.bb',
    locale: 'en_BB',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, type: 'image/jpeg', alt: 'Vetted.bb, trusted professionals in Barbados' }],
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} | Vetted.bb`, description: DESCRIPTION, images: [`${SITE_URL}/og-image.jpg`] },
}

const TEAM_POINTS = [
  {
    title: 'Everyone sees everything',
    body: 'Enquiries, quotes and invoices belong to the organisation, not to one person’s inbox. A colleague on leave never leaves a quote unseen.',
  },
  {
    title: 'One login per person',
    body: 'Each member signs in as themselves and acts for the organisation. The record shows who enquired, who accepted, and when.',
  },
  {
    title: 'Verified, both ways',
    body: 'Professionals carry a verified badge. Organisations are checked too, so a professional knows an enquiry from you is genuine.',
  },
]

const STEPS = [
  { n: 1, title: 'Create your account', body: 'Name your organisation, add your billing details, invite your team.' },
  { n: 2, title: 'Search and shortlist', body: 'Filter by trade, parish, rating and verification. Save the ones you like.' },
  { n: 3, title: 'Enquire as your organisation', body: 'Send an enquiry from a profile. It goes out in your organisation’s name.' },
  { n: 4, title: 'Receive quotes', body: 'Professionals reply with itemised quotes. Ask several and compare.' },
  { n: 5, title: 'Decide', body: 'Accept the one you want. Everyone on the team can see the outcome.' },
  { n: 6, title: 'They invoice you directly', body: 'The professional invoices your organisation. You pay them. Nothing passes through us.' },
]

const GOVT_POINTS = [
  'Filter the pool to professionals already registered as government vendors with the Treasury.',
  'Professionals keep the details a vendor registration asks for ready on their profile, so onboarding a new supplier is quicker.',
  'Quotes and invoices print with your department or division, your billing address and your reference number, in Bds$.',
  'Payment terms default to what your organisation sets, so every quote starts from the right expectation.',
]

const NOT_POINTS = [
  ['No fees', 'Free for organisations and free for professionals. No commission on any job.'],
  ['No middleman', 'We never issue invoices or handle payment. Professionals invoice you, and you pay them.'],
  ['No lock-in', 'Your records are yours. Export or print any quote or invoice at any time.'],
]

const CARD = { borderTop: '4px solid #00267F', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }

export default function ForOrganisations() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>

      {/* Hero */}
      <section className="w-full px-4 sm:px-8 py-16 sm:py-24" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#F9C000' }}>For organisations</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight" style={{ letterSpacing: '-1px' }}>
            Hire with confidence, as a team.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-9 max-w-2xl mx-auto" style={{ color: '#c3d4ff' }}>
            One account for your organisation. Search a pool of verified local professionals, enquire together,
            decide together, and keep every quote and invoice in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup?role=organisation" className="inline-block text-base font-bold px-8 py-4 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}>
              Create an organisation account
            </Link>
            <a href="#how-it-works" className="inline-block text-base font-bold px-8 py-4 rounded-full transition-colors hover:bg-white/10" style={{ border: '2px solid rgba(255,255,255,0.85)', color: '#fff', textDecoration: 'none' }}>
              See how it works
            </a>
          </div>
          <p className="text-sm mt-6" style={{ color: 'rgba(255,255,255,0.7)' }}>Free to use. No commission, ever.</p>
        </div>
      </section>

      {/* Built for teams */}
      <section className="px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 text-center" style={{ letterSpacing: '-0.5px' }}>Built for teams, not inboxes</h2>
          <p className="text-base text-gray-600 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            Most hiring in Barbados runs on one person’s WhatsApp. That works until that person is away, moves on, or forgets. An organisation account fixes the record.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TEAM_POINTS.map(p => (
              <div key={p.title} className="bg-white px-6 py-7" style={CARD}>
                <h3 className="text-lg font-bold text-gray-900 mb-2.5 leading-snug">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 sm:px-8 py-16 sm:py-20" style={{ backgroundColor: 'var(--surface-card)', scrollMarginTop: 80 }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center" style={{ letterSpacing: '-0.5px' }}>How it works</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {STEPS.map(s => (
              <li key={s.n} className="flex flex-col rounded-2xl px-6 py-7 h-full" style={{ backgroundColor: 'var(--selected-fill)', borderTop: '4px solid #F9C000' }}>
                <span className="inline-flex items-center justify-center rounded-full text-sm font-extrabold mb-4 flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: '#00267F', color: '#F9C000', fontFamily: "'Sora', sans-serif" }} aria-hidden="true">{s.n}</span>
                <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug md:min-h-[2.75rem]">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Government */}
      <section className="px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white px-6 py-8 sm:px-10 sm:py-10" style={CARD}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#00267F' }}>Public sector</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3" style={{ letterSpacing: '-0.5px' }}>Working with government departments</h2>
            <p className="text-base text-gray-600 leading-relaxed mb-6">
              Public bodies have their own way of paying suppliers. The platform is built to fit it rather than fight it.
            </p>
            <ul className="flex flex-col gap-4">
              {GOVT_POINTS.map(c => (
                <li key={c} className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5" style={{ width: 22, height: 22, backgroundColor: '#F9C000' }} aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00267F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="text-base text-gray-700 leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What we do not do */}
      <section className="px-4 sm:px-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center" style={{ letterSpacing: '-0.5px' }}>What we deliberately don’t do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {NOT_POINTS.map(([t, b]) => (
              <div key={t} className="bg-white px-6 py-7" style={CARD}>
                <h3 className="text-lg font-bold text-gray-900 mb-2.5">{t}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="w-full px-4 sm:px-8 py-14" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ letterSpacing: '-0.5px' }}>Set up your organisation in two minutes</h2>
          <p className="text-base leading-relaxed mb-6" style={{ color: '#c3d4ff' }}>Create the account, invite your team, and start with your first search.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup?role=organisation" className="inline-block text-sm font-bold px-7 py-3 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}>
              Create an organisation account
            </Link>
            <Link href="/search" className="inline-block text-sm font-bold px-7 py-3 rounded-full transition-colors hover:bg-white/10" style={{ border: '2px solid rgba(255,255,255,0.85)', color: '#fff', textDecoration: 'none' }}>
              Browse the pool first
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
