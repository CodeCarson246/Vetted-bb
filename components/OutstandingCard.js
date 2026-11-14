'use client'
import Link from 'next/link'
import { money2 } from '@/lib/payments'

// "What is owed", at the top of a professional's dashboard (OUTSTANDING:
// owed to them) and an organisation's Records (PAYABLE: what they owe
// professionals). Built from lib/payments outstandingSummary, so part
// payments are already taken off. The whole card links to the unpaid list.
// onShow: on the page the list is already on, show the unpaid list there
// instead of navigating (a link to the same page would not change it).
export default function OutstandingCard({ label = 'Outstanding', summary, href, loading = false, onShow }) {
  const { amount = 0, invoices = 0, overdue = 0 } = summary || {}
  const line = invoices === 0
    ? 'All invoices paid'
    : `across ${invoices} invoice${invoices === 1 ? '' : 's'}`
  return (
    <Link
      href={href}
      onClick={onShow ? (e => { e.preventDefault(); onShow() }) : undefined}
      className="block bg-white rounded-2xl px-6 py-5 mb-6 transition-shadow hover:shadow-md"
      style={{ borderTop: '4px solid #00267F', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,38,127,0.08)', textDecoration: 'none' }}
      aria-label={`${label}: Bds$${money2(amount)}. ${line}${overdue > 0 ? `, ${overdue} overdue` : ''}. View unpaid invoices.`}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1" style={{ color: '#00267F', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
        {loading ? '…' : `Bds$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </p>
      {!loading && (
        <p className="text-sm text-gray-500 mt-1">
          {line}
          {invoices > 0 && overdue > 0 && (
            <> · <span className="font-semibold" style={{ color: '#dc2626' }}>{overdue} overdue</span></>
          )}
        </p>
      )}
    </Link>
  )
}
