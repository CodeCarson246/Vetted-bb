'use client'
import {
  invoicesOf, invoiceBalance, invoicePaymentStatus, jobOutstanding, jobPaymentStatus, amountPaid,
  canRaiseBalance, money2, PAYMENT_LABELS,
} from '@/lib/payments'

// Payments on a job, in the professional's Quotes & earnings: each invoice
// with what is paid and still owed, the payment history, and the actions
// (Record a payment, Raise balance invoice). Replaces the old "Paid" tick
// box; a job ticked paid before payments existed still shows, with Undo.
const CHIP = {
  paid: { backgroundColor: '#DCFCE7', color: '#166534' },
  'part-paid': { backgroundColor: '#FEF3C7', color: '#92400E' },
  unpaid: { backgroundColor: '#F3F4F6', color: '#4B5563' },
}

const fmt = key => {
  if (!key) return ''
  const d = new Date(String(key).length === 10 ? `${key}T12:00:00` : key)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PaymentChip({ status }) {
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={CHIP[status] || CHIP.unpaid}>{PAYMENT_LABELS[status] || status}</span>
}

export default function PaymentsPanel({ quote, payments = [], removed = [], busy, onRecord, onDelete, onRaiseBalance, onUndoLegacyPaid, onTogglePause }) {
  const invoices = invoicesOf(quote)
  if (invoices.length === 0) return null
  const legacyPaid = !!quote.paid_at && payments.length === 0 && Number(quote.amount_paid || 0) === 0
  const owed = jobOutstanding(quote)

  return (
    <div className="mt-4 rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Payments</span>
          <PaymentChip status={jobPaymentStatus(quote)} />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">
          Paid Bds${money2(amountPaid(quote))} of Bds${money2(quote.total)}{owed > 0 ? ` · Bds$${money2(owed)} outstanding` : ''}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {invoices.map(inv => {
          const { outstanding } = invoiceBalance(quote, inv)
          return (
            <li key={inv.number} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-700">
                <span className="font-semibold">{inv.kind === 'deposit' ? 'Deposit invoice' : inv.kind === 'balance' ? 'Balance invoice' : 'Invoice'} {inv.number}</span>
                {inv.due ? <span className="text-gray-400"> · due {fmt(inv.due)}</span> : null}
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-gray-600">Bds${money2(inv.amount)}{outstanding > 0 && outstanding < inv.amount ? ` (Bds$${money2(outstanding)} left)` : ''}</span>
                <PaymentChip status={invoicePaymentStatus(quote, inv)} />
              </span>
            </li>
          )
        })}
      </ul>

      {payments.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">History</p>
          <ul className="flex flex-col gap-1">
            {payments.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                <span>
                  {fmt(p.received_on)} · <span className="font-semibold tabular-nums">Bds${money2(p.amount)}</span>
                  {p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ref ${p.reference}` : ''}
                  {p.invoice_number ? <span className="text-gray-400"> · {p.invoice_number}</span> : null}
                </span>
                <button onClick={() => onDelete(p)} disabled={busy} className="text-[11px] font-medium text-gray-400 hover:text-red-600 disabled:opacity-50" title="Remove this payment (for example if it was entered by mistake)">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Payments that were removed stay on record (the database keeps it). */}
      {removed.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Removed</p>
          <ul className="flex flex-col gap-1">
            {removed.map(r => (
              <li key={r.id} className="text-xs text-gray-400">
                <span className="line-through">{fmt(r.received_on)} · <span className="tabular-nums">Bds${money2(r.amount)}</span>{r.method ? ` · ${r.method}` : ''}</span>
                {' '}· removed {fmt(r.removed_at)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {legacyPaid && (
        <p className="text-xs text-gray-500">
          Marked paid {fmt(quote.paid_at)}.{' '}
          <button onClick={onUndoLegacyPaid} disabled={busy} className="font-medium underline disabled:opacity-50">Undo</button>
        </p>
      )}

      {/* Automatic payment reminders on this invoice (lib/paymentReminders) */}
      {owed > 0 && !legacyPaid && onTogglePause && (
        <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={!!quote.reminders_paused} disabled={busy} onChange={onTogglePause} className="mt-0.5" />
          <span>
            Pause reminders
            <span className="block text-gray-400">
              {quote.reminders_paused
                ? 'No reminders go to the client about this invoice.'
                : quote.last_reminder_sent ? `Last reminder emailed ${fmt(quote.last_reminder_sent)}.` : 'For when you have arranged something with the client yourself.'}
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {owed > 0 && !legacyPaid && (
          <button onClick={onRecord} disabled={busy} className="text-xs font-semibold px-3.5 py-1.5 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>
            Record a payment
          </button>
        )}
        {canRaiseBalance(quote) && (
          <button onClick={onRaiseBalance} disabled={busy} className="text-xs font-semibold px-3.5 py-1.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#F9C000', color: '#00267F' }}>
            Raise balance invoice (Bds${money2(owed)})
          </button>
        )}
      </div>
    </div>
  )
}
