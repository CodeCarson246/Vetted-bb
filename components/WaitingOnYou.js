import Link from 'next/link'
import { invoicePromptLink, waitingSince } from '@/lib/invoicing'

// Clients who have accepted a quote and are now waiting for the invoice.
// A missed notification should not be able to leave someone hanging, so this
// sits at the top of the dashboard until each one is sent.
export default function WaitingOnYou({ quotes, now }) {
  if (!quotes || quotes.length === 0) return null
  return (
    <section aria-labelledby="waiting-on-you" className="bg-white rounded-2xl mb-6 overflow-hidden" style={{ border: '1.5px solid #F9C000' }}>
      <div className="px-5 sm:px-6 pt-4 pb-1">
        <h2 id="waiting-on-you" className="text-base font-bold text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Waiting on you</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {quotes.length === 1
            ? 'A client has accepted your quote and is waiting for the invoice.'
            : `${quotes.length} clients have accepted a quote and are waiting for the invoice.`}
        </p>
      </div>
      <ul>
        {quotes.map((q, i) => (
          <li key={q.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 flex-wrap" style={{ borderTop: i > 0 ? '1px solid var(--row-stripe)' : 'none' }}>
            <div className="flex-1 min-w-0" style={{ minWidth: 180 }}>
              <p className="text-sm font-semibold text-gray-900 truncate">{q.client_name || 'Client'} · Bds${Number(q.total || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Quote {q.quote_number}{q.accepted_at ? ` · accepted ${waitingSince(q.accepted_at, now)}` : ''}
              </p>
            </div>
            <Link
              href={invoicePromptLink(q.id)}
              className="text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity flex-shrink-0"
              style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}
            >
              Send invoice
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
