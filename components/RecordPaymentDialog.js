'use client'
import { useState } from 'react'
import { todayKeyBarbados } from '@/lib/rentals'
import { invoiceToPay, invoiceBalance, jobOutstanding, money2 } from '@/lib/payments'

// "Record a payment": money received against an invoice. Each payment is its
// own row (a deposit, a second payment, a final one); nothing is overwritten.
// The amount starts at what is still owed on the invoice being paid.
const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

export default function RecordPaymentDialog({ quote, busy, error, onSave, onClose }) {
  const invoice = invoiceToPay(quote)
  const owedOnInvoice = invoice ? invoiceBalance(quote, invoice).outstanding : 0
  const owedOnJob = jobOutstanding(quote)
  const [amount, setAmount] = useState(() => money2(owedOnInvoice || owedOnJob))
  const [receivedOn, setReceivedOn] = useState(() => todayKeyBarbados())
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [problem, setProblem] = useState('')

  if (!quote || !invoice) return null

  function save() {
    const value = Math.round(Number(amount) * 100) / 100
    if (!(value > 0)) { setProblem('Enter the amount received.'); return }
    if (value > owedOnJob + 0.001) { setProblem(`That is more than the Bds$${money2(owedOnJob)} still owed on this job.`); return }
    if (!receivedOn || receivedOn > todayKeyBarbados()) { setProblem('Choose the day the money came in (not a future date).'); return }
    setProblem('')
    onSave({ invoice_number: invoice.number, amount: value, received_on: receivedOn, method: method.trim().slice(0, 80) || null, reference: reference.trim().slice(0, 120) || null })
  }

  const label = invoice.kind === 'deposit' ? 'deposit invoice' : invoice.kind === 'balance' ? 'balance invoice' : 'invoice'
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="record-payment-title" onClick={e => e.stopPropagation()}>
        <h3 id="record-payment-title" className="font-bold text-gray-900 text-lg" style={{ fontFamily: 'var(--font-display)' }}>Record a payment</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Against {label} {invoice.number} from {quote.client_name || 'your client'}. Bds${money2(owedOnInvoice)} still owed on it.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label htmlFor="payment-amount" className="block text-xs font-semibold text-gray-700 mb-1">Amount (Bds$)</label>
            <input id="payment-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="payment-date" className="block text-xs font-semibold text-gray-700 mb-1">Date received</label>
            <input id="payment-date" type="date" value={receivedOn} max={todayKeyBarbados()} onChange={e => setReceivedOn(e.target.value)} className={fieldCls} />
          </div>
        </div>
        <label htmlFor="payment-method" className="block text-xs font-semibold text-gray-700 mt-3 mb-1">Method</label>
        <input id="payment-method" type="text" list="payment-methods" value={method} onChange={e => setMethod(e.target.value)} placeholder="Bank transfer, cash, cheque…" className={fieldCls} />
        <datalist id="payment-methods">
          <option value="Bank transfer" /><option value="Cash" /><option value="Cheque" /><option value="Card" />
        </datalist>
        <label htmlFor="payment-reference" className="block text-xs font-semibold text-gray-700 mt-3 mb-1">Reference <span className="text-gray-400 font-normal">(optional)</span></label>
        <input id="payment-reference" type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Cheque no., transfer ref…" className={fieldCls} />

        {(problem || error) && (
          <p role="alert" className="mt-4 text-sm font-medium rounded-lg px-3 py-2" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{problem || error}</p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
