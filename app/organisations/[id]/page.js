import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import TrustMark from '@/components/TrustMark'
import { ORG_KINDS } from '@/lib/organisations'
import { formatParish } from '@/lib/formatParish'

// A light public profile for an organisation, so a professional who gets
// an enquiry from one can see who it is and what it has done on the
// platform. Reads through organisation_public() (SQL section 31), which
// returns only public fields and two counts: no address, email or members.
export const metadata = { title: 'Organisation profile' }
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OrganisationPublic({ params }) {
  const { id } = await params
  let org = null
  if (UUID.test(id || '')) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data } = await supabase.rpc('organisation_public', { p_id: id })
    org = Array.isArray(data) ? data[0] : data
  }

  if (!org) {
    return (
      <main className="min-h-screen page-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl px-8 py-10 text-center max-w-md" style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
          <p className="font-semibold text-gray-900 mb-1">Organisation not found</p>
          <p className="text-sm text-gray-500 mb-5">It may have been removed, or the link is wrong.</p>
          <Link href="/" className="text-sm font-semibold" style={{ color: '#00267F' }}>Back to Vetted.bb</Link>
        </div>
      </main>
    )
  }

  const kindLabel = ORG_KINDS.find(k => k.value === org.kind)?.label || 'Organisation'
  const since = org.created_at ? new Date(org.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null
  const initials = (org.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <main className="min-h-screen page-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="bg-white rounded-2xl px-6 py-7 sm:px-8 sm:py-8" style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-bold" style={{ backgroundColor: '#00267F', color: '#F9C000', fontFamily: "'Sora', sans-serif" }} aria-hidden="true">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
                {org.verified
                  ? <TrustMark kind="organisation" size={18} withLabel />
                  : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Not yet verified</span>}
              </div>
              {org.division && <p className="text-sm font-medium text-gray-700 mt-0.5">{org.division}</p>}
              <p className="text-sm text-gray-500 mt-1">
                {kindLabel}{org.parish ? ` · ${formatParish(org.parish)}` : ''}{since ? ` · On Vetted.bb since ${since}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            {[
              { label: 'Jobs completed', value: org.jobs_completed },
              { label: 'Quotes received', value: org.quotes_received },
            ].map(t => (
              <div key={t.label} className="rounded-xl p-4" style={{ backgroundColor: 'var(--selected-fill)' }}>
                <p className="text-2xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "'Sora', sans-serif" }}>{t.value ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 text-sm text-gray-600 leading-relaxed">
            {org.verified
              ? <p>Vetted.bb has checked that this organisation is genuine. Professionals who receive an enquiry from it can treat it as coming from the organisation named above.</p>
              : <p>This organisation has an account on Vetted.bb but has not yet been verified. Professionals may want to confirm an enquiry by other means before committing.</p>}
            <p className="mt-2 text-xs text-gray-400">Organisations hire professionals through Vetted.bb and are invoiced by them directly. <Link href="/badges" className="font-semibold" style={{ color: '#00267F' }}>What our badges mean</Link></p>
          </div>
        </div>
      </div>
    </main>
  )
}
