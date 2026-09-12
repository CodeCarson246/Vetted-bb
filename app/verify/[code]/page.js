import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { formatVerifyCode, normaliseVerifyCode } from '@/lib/verifyCode'
import { currencySymbol } from '@/lib/organisations'
import TrustMark from '@/components/TrustMark'

// Public document check. Anyone holding a printed quote, invoice or receipt
// can confirm it is genuine and see where it stands. The lookup is a
// SECURITY DEFINER function that returns only the fields shown here: no
// email, no address, no line items. Not indexed.
export const metadata = {
  title: 'Verify a document',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const STAGES = [
  { key: 'issued',    label: 'Quote issued' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'invoiced',  label: 'Invoiced' },
  { key: 'completed', label: 'Job completed' },
  { key: 'paid',      label: 'Paid' },
]
const ORDER = { sent: 0, accepted: 1, invoiced: 2, completed: 3, paid: 4 }

function fmt(d) {
  if (!d) return null
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d)
  return isNaN(dt) ? null : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function VerifyDocument({ params }) {
  const { code: raw } = await params
  const code = normaliseVerifyCode(raw)

  let doc = null
  if (code.length >= 6) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data } = await supabase.rpc('verify_document', { p_code: code })
    doc = Array.isArray(data) ? data[0] : data
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className="max-w-xl mx-auto px-4 sm:px-8 py-12">
        <p className="text-xs font-bold uppercase tracking-widest mb-2 text-center" style={{ color: '#00267F' }}>Document verification</p>

        {!doc ? (
          <div className="bg-white rounded-2xl px-6 py-10 sm:px-10 text-center" style={{ borderTop: '4px solid #dc2626', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
            <p className="text-3xl mb-3" aria-hidden="true">✕</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">No document found for {formatVerifyCode(code) || 'that code'}</h1>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Check the code printed at the bottom of the document and try again. If it still isn’t found, the document was not issued through Vetted.bb.
            </p>
            <Link href="/verify" className="inline-block text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90" style={{ backgroundColor: '#00267F', textDecoration: 'none' }}>Try another code</Link>
          </div>
        ) : (() => {
          const isDeclined = doc.status === 'declined'
          const stage = ORDER[doc.status] ?? 0
          const sym = currencySymbol(doc.currency)
          const dates = { issued: fmt(doc.quote_date), invoiced: fmt(doc.invoiced_at), completed: fmt(doc.completed_at), paid: fmt(doc.paid_at) }
          const headline = isDeclined ? 'Quote declined' : STAGES[stage].label
          return (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ borderTop: `4px solid ${isDeclined ? '#9ca3af' : '#16a34a'}`, boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
              <div className="px-6 sm:px-10 pt-8 pb-6 text-center border-b border-gray-100">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: isDeclined ? '#F3F4F6' : '#DCFCE7' }} aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={isDeclined ? '#6b7280' : '#16a34a'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Genuine Vetted.bb document</h1>
                <p className="text-sm text-gray-500">Code <span className="font-mono font-semibold text-gray-800">{formatVerifyCode(code)}</span></p>
                <p className="mt-4 inline-block text-sm font-bold px-4 py-1.5 rounded-full" style={isDeclined ? { backgroundColor: '#F3F4F6', color: '#4B5563' } : { backgroundColor: '#DCFCE7', color: '#166534' }}>
                  Current status: {headline}
                </p>
              </div>

              <dl className="px-6 sm:px-10 py-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm border-b border-gray-100">
                <div><dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued by</dt><dd className="font-semibold text-gray-900 mt-0.5">{doc.issuer_name}</dd></div>
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Billed to</dt>
                  <dd className="font-semibold text-gray-900 mt-0.5">
                    {doc.billed_to || 'Client'}
                    {doc.organisation_verified && <span className="ml-1.5"><TrustMark kind="organisation" size={14} withLabel /></span>}
                  </dd>
                </div>
                <div><dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quote number</dt><dd className="font-mono text-gray-900 mt-0.5">{doc.quote_number}</dd></div>
                {doc.invoice_number && <div><dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice number</dt><dd className="font-mono text-gray-900 mt-0.5">{doc.invoice_number}</dd></div>}
                <div><dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</dt><dd className="font-bold mt-0.5" style={{ color: '#00267F' }}>{sym}{Number(doc.total || 0).toFixed(2)}</dd></div>
              </dl>

              {!isDeclined && (
                <ol className="px-6 sm:px-10 py-6 flex flex-col gap-3">
                  {STAGES.map((s, i) => {
                    const done = i <= stage
                    const date = dates[s.key]
                    return (
                      <li key={s.key} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: done ? '#00267F' : '#E5E7EB' }} aria-hidden="true">
                          {done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className={`text-sm flex-1 ${done ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
                        {done && date && <span className="text-xs text-gray-500">{date}</span>}
                      </li>
                    )
                  })}
                </ol>
              )}

              <div className="px-6 sm:px-10 py-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">Vetted.bb is the record of this document. It does not process or hold payment; the professional invoices the client directly.</p>
              </div>
            </div>
          )
        })()}

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="font-semibold" style={{ color: '#00267F' }}>Vetted.bb</Link> · Connecting Barbados
        </p>
      </div>
    </main>
  )
}
