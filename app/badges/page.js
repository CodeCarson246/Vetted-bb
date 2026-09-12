import Link from 'next/link'
import { TRUST_MARKS } from '@/components/TrustMark'
import BadgeGlyph from '@/components/badgeArt'

export const metadata = {
  title: 'What our badges mean',
  description: 'The trust marks on Vetted.bb, what each one means, and how a professional or organisation earns it.',
  alternates: { canonical: '/badges' },
}

const DETAILS = [
  {
    kind: 'verified',
    how: 'Automatically when a professional confirms their phone number, or manually after Vetted.bb checks their identity and work.',
    who: 'Professionals',
    note: 'Look for it next to the name on search cards, profiles and in conversations.',
  },
  {
    kind: 'organisation',
    how: 'Manually. Vetted.bb checks that an organisation account belongs to the organisation it names before marking it. Unverified organisations can still search and enquire.',
    who: 'Organisations',
    note: 'Professionals see it on enquiries, so they know a message from a ministry, a company or a charity is genuine.',
  },
  {
    kind: 'vendor',
    how: 'The professional sets it themselves once they have registered as a vendor with the Treasury. It is a declaration, not something Vetted.bb can verify, and it is not required to use the site.',
    who: 'Professionals',
    note: 'Organisations hiring for government work can filter search results to registered vendors.',
  },
  {
    kind: 'featured',
    how: 'Chosen by Vetted.bb. It is not paid for and cannot be bought.',
    who: 'Professionals',
    note: 'Featured professionals appear on the homepage.',
  },
]

const CARD = { borderTop: '4px solid #00267F', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }

export default function Badges() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
      <section className="w-full px-4 sm:px-8 py-14 sm:py-16" style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#F9C000' }}>Trust marks</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight" style={{ letterSpacing: '-0.8px' }}>What our badges mean</h1>
          <p className="text-base leading-relaxed max-w-2xl mx-auto" style={{ color: '#c3d4ff' }}>
            Four marks, each with one meaning. None can be bought.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {DETAILS.map(d => {
            const meta = TRUST_MARKS[d.kind]
            return (
              <div key={d.kind} className="bg-white px-6 py-6 sm:px-8 sm:py-7" style={CARD}>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="inline-flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, backgroundColor: 'var(--selected-fill)' }}>
                    {/* The emblem alone: the vendor and featured pills are wider than this box, and the text explains them */}
                    <BadgeGlyph kind={d.kind} size={26} label={meta.title} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">{meta.title}</h2>
                    <p className="text-xs text-gray-400">Shown on: {d.who}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{meta.explain}</p>
                <dl className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="font-semibold text-gray-500">How it’s earned</dt><dd className="text-gray-700">{d.how}</dd>
                  <dt className="font-semibold text-gray-500">Where you’ll see it</dt><dd className="text-gray-700">{d.note}</dd>
                </dl>
              </div>
            )
          })}

          <div className="bg-white px-6 py-6 sm:px-8" style={CARD}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Documents have their own check</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Every quote, invoice and receipt issued through Vetted.bb carries a verification code. Anyone holding the document can confirm it is genuine and see whether it has been accepted, invoiced or paid at{' '}
              <Link href="/verify" className="font-semibold" style={{ color: '#00267F' }}>vetted.bb/verify</Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
