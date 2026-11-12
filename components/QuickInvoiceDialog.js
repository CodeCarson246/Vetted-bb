'use client'
import { PAYMENT_TERMS } from '@/lib/paymentTerms'
import { invoiceDueDate, fmtInvoiceDate } from '@/lib/invoicing'
import { todayKeyBarbados } from '@/lib/rentals'

// "Send this invoice?" — where a professional lands from the Send invoice
// button on a notification, a push or the acceptance email. Who it goes to,
// how much, when it is due, and one button. A sent invoice cannot be unsent,
// so it is a confirmation rather than a one-tap send.
export default function QuickInvoiceDialog({ quote, terms, onTermsChange, busy, onSend, onClose, onMoreOptions }) {
  if (!quote) return null
  const dueKey = invoiceDueDate(todayKeyBarbados(), terms)
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="quick-invoice-title" onClick={e => e.stopPropagation()}>
        <h3 id="quick-invoice-title" className="font-bold text-gray-900 text-lg" style={{ fontFamily: 'var(--font-display)' }}>Send this invoice?</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {quote.client_name || 'Your client'} accepted quote {quote.quote_number} and is waiting for it.
        </p>
        <dl className="mt-4 rounded-xl border border-gray-100 text-sm">
          <div className="flex justify-between gap-3 px-4 py-2.5">
            <dt className="text-gray-500 flex-shrink-0">To</dt>
            <dd className="font-medium text-gray-900 text-right truncate">{quote.client_name || quote.client_email || 'Client'}</dd>
          </div>
          <div className="flex justify-between gap-3 px-4 py-2.5 border-t border-gray-100">
            <dt className="text-gray-500">Amount</dt>
            <dd className="font-bold tabular-nums" style={{ color: 'var(--accent)' }}>Bds${Number(quote.total || 0).toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-3 px-4 py-2.5 border-t border-gray-100">
            <dt className="text-gray-500">Payment due</dt>
            <dd className="font-medium text-gray-900">{fmtInvoiceDate(dueKey)}</dd>
          </div>
        </dl>
        <label htmlFor="quick-invoice-terms" className="block text-xs font-semibold text-gray-700 mt-4 mb-1">Payment terms</label>
        <select
          id="quick-invoice-terms"
          value={terms}
          onChange={e => onTermsChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
        >
          {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors">
            Not now
          </button>
          <button
            onClick={onSend}
            disabled={busy}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
          >
            {busy ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
        {onMoreOptions && (
          <button onClick={onMoreOptions} className="block mx-auto mt-3 text-xs font-medium text-gray-400 hover:text-gray-600">
            Add their phone, address or your terms first
          </button>
        )}
      </div>
    </div>
  )
}
