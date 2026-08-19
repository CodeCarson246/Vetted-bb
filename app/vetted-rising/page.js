import Link from 'next/link'
import VettedRisingForm from '@/components/VettedRisingForm'
import { SITE_URL } from '@/lib/siteUrl'

const TITLE = 'Vetted Rising — Helping young Barbadians turn skills into work'
const DESCRIPTION = 'A programme giving young Barbadians aged 16–30 a professional profile, guided support and real visibility to clients across the island.'

export const metadata = {
  // The root template appends " | Vetted.bb".
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/vetted-rising' },
  openGraph: {
    title: `${TITLE} | Vetted.bb`,
    description: DESCRIPTION,
    url: `${SITE_URL}/vetted-rising`,
    siteName: 'Vetted.bb',
    locale: 'en_BB',
    type: 'website',
    // A page-level openGraph replaces the root one, so the site default
    // share image has to be restated here.
    images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, type: 'image/jpeg', alt: 'Vetted.bb, trusted professionals in Barbados' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | Vetted.bb`,
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-image.jpg`],
  },
}

const PROBLEMS = [
  {
    title: 'Talent isn’t the shortage',
    body: 'Young Barbadians are skilled, in trades, design, photography, catering, tutoring and more. What they lack is a way to be found.',
  },
  {
    title: 'No digital presence',
    body: 'Most have no website, no portfolio and no way to show clients what they can do or what they charge.',
  },
  {
    title: 'Word of mouth only goes so far',
    body: 'Without a network, good work stays invisible. Vetted Rising changes where that work gets seen.',
  },
]

const BENEFITS = [
  {
    n: '01',
    title: 'A professional profile, built with you',
    body: 'A guided session where we build your profile together: photos, the services you offer, your pricing and your parish. You leave with a live profile clients can find.',
  },
  {
    n: '02',
    title: 'Rising Talent visibility',
    body: 'For your first 90 days, your profile carries a Rising Talent badge, showing clients you’re new, backed, and worth taking a chance on.',
  },
  {
    n: '03',
    title: 'Free, and it stays free',
    body: 'No fee to join, no commission on your work, no subscription. Vetted.bb is free for professionals.',
  },
]

const STEPS = [
  { n: 1, title: 'Apply', body: 'Fill in the short form below. Takes two minutes.' },
  { n: 2, title: 'We get in touch', body: 'We’ll contact you on WhatsApp to talk through what you do and confirm a session date.' },
  { n: 3, title: 'Build your profile', body: 'Attend a guided session where we build your profile with you: photos, services, pricing.' },
  { n: 4, title: 'Get found', body: 'Your profile goes live with the Rising Talent badge and starts appearing in client searches.' },
]

const CRITERIA = [
  'Aged 16 to 30',
  'Living in Barbados',
  'Offering any skill or service: a trade, a craft, a creative service, tutoring, catering, anything someone would pay for',
  'No qualifications required. No experience minimum. If you can do the work, you can apply.',
]

// The site's standard card treatment: white, 4px navy top border, soft shadow.
const CARD = {
  borderTop: '4px solid #00267F',
  borderRadius: 16,
  boxShadow: '0 2px 12px rgba(0,38,127,0.08)',
}

export default function VettedRising() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: '#F3F4F8' }}>

      {/* 1. Hero */}
      <section className="w-full px-4 sm:px-8 py-16 sm:py-24" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#F9C000' }}>
            A Vetted.bb programme
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight" style={{ letterSpacing: '-1px' }}>
            Vetted Rising
          </h1>
          <p className="text-lg sm:text-xl font-semibold mb-5" style={{ color: '#F9C000' }}>
            Helping young Barbadians turn skills into work.
          </p>
          <p className="text-base sm:text-lg leading-relaxed mb-9 max-w-2xl mx-auto" style={{ color: '#c3d4ff' }}>
            Barbados has a generation of young people who can do the work but can&apos;t get seen.
            Vetted Rising gives them a professional profile, guided support to build it, and
            visibility to real clients across the island.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#apply"
              className="inline-block text-base font-bold px-8 py-4 rounded-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}
            >
              Apply to join
            </a>
            <a
              href="#how-it-works"
              className="inline-block text-base font-bold px-8 py-4 rounded-full transition-colors hover:bg-white/10"
              style={{ border: '2px solid rgba(255,255,255,0.85)', color: '#fff', textDecoration: 'none' }}
            >
              How it works
            </a>
          </div>

          <p className="text-sm mt-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Now accepting applications for our first cohort.
          </p>
        </div>
      </section>

      {/* 2. The problem */}
      <section className="px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 text-center" style={{ letterSpacing: '-0.5px' }}>
            The problem
          </h2>
          <p className="text-base text-gray-600 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            The work is there. The people who can do it are there. What is missing is the link between them.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PROBLEMS.map(p => (
              <div key={p.title} className="bg-white px-6 py-7" style={CARD}>
                <h3 className="text-lg font-bold text-gray-900 mb-2.5 leading-snug">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. What participants get */}
      <section className="px-4 sm:px-8 py-16 sm:py-20" style={{ backgroundColor: '#fff' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center" style={{ letterSpacing: '-0.5px' }}>
            What you get
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BENEFITS.map(b => (
              <div key={b.n}>
                <p
                  className="text-3xl font-extrabold mb-3"
                  style={{ color: '#F9C000', fontFamily: "'Sora', sans-serif", letterSpacing: '-1px' }}
                  aria-hidden="true"
                >
                  {b.n}
                </p>
                <h3 className="text-lg font-bold text-gray-900 mb-2.5 leading-snug">{b.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How the programme works */}
      <section id="how-it-works" className="px-4 sm:px-8 py-16 sm:py-20" style={{ scrollMarginTop: 80 }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center" style={{ letterSpacing: '-0.5px' }}>
            How it works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {STEPS.map(s => (
              <li key={s.n} className="bg-white px-6 py-7" style={CARD}>
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-extrabold mb-3.5"
                  style={{ backgroundColor: '#00267F', color: '#fff' }}
                >
                  {s.n}
                </span>
                <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Who it's for */}
      <section className="px-4 sm:px-8 pb-16 sm:pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white px-6 py-8 sm:px-10 sm:py-10" style={CARD}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6" style={{ letterSpacing: '-0.5px' }}>
              Who it&apos;s for
            </h2>
            <ul className="flex flex-col gap-4">
              {CRITERIA.map(c => (
                <li key={c} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
                    style={{ width: 22, height: 22, backgroundColor: '#F9C000' }}
                    aria-hidden="true"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00267F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-base text-gray-700 leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6. Application form */}
      <section id="apply" className="px-4 sm:px-8 pb-16 sm:pb-20" style={{ scrollMarginTop: 80 }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 text-center" style={{ letterSpacing: '-0.5px' }}>
            Apply to join Vetted Rising
          </h2>
          <p className="text-base text-gray-600 mb-8 text-center">Six questions. Takes two minutes.</p>
          <VettedRisingForm />
        </div>
      </section>

      {/* 7. Closing band */}
      <section className="w-full px-4 sm:px-8 py-14" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-base sm:text-lg text-white leading-relaxed mb-5">
            Vetted Rising is part of Vetted.bb, Barbados&apos; platform for verified local professionals.
          </p>
          <Link
            href="/search"
            className="inline-block text-sm font-bold px-7 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}
          >
            Browse professionals on Vetted.bb
          </Link>
        </div>
      </section>
    </main>
  )
}
