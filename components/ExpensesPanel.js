'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayKeyBarbados } from '@/lib/rentals'
import { canStillBill, jobProfit } from '@/lib/expenses'
import { money2 } from '@/lib/payments'
import { newId } from '@/lib/newId'

// Expenses on a job, in the professional's Quotes & earnings. PRIVATE: this
// component only ever renders for the professional, and job_expenses is
// readable by them alone (SQL Section 47). Ticking "Bill to client" puts an
// expense on the next invoice as a cost line (lib/expenses.js); until then,
// and if it is left unticked, the client never sees it anywhere.
//
// Receipts go to the PRIVATE 'receipts' bucket under <user id>/<job id>/ and
// are opened through a five-minute signed link.
const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const fmt = key => {
  if (!key) return ''
  const d = new Date(`${String(key).slice(0, 10)}T12:00:00`)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ExpensesPanel({ quote, freelancerId, userId, expenses = [], onChange, onNotice }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [incurredOn, setIncurredOn] = useState(() => todayKeyBarbados())
  const [bill, setBill] = useState(false)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const billable = canStillBill(quote)
  const p = jobProfit(quote, expenses)

  function reset() {
    setDescription(''); setAmount(''); setIncurredOn(todayKeyBarbados()); setBill(false); setFile(null); setProblem('')
  }

  async function add() {
    const value = Math.round(Number(amount) * 100) / 100
    if (!description.trim()) { setProblem('Say what the expense was.'); return }
    if (!(value > 0)) { setProblem('Enter the amount it cost.'); return }
    if (!incurredOn || incurredOn > todayKeyBarbados()) { setProblem('Choose the day it was bought (not a future date).'); return }
    if (file && (!RECEIPT_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024)) { setProblem('A receipt must be a photo (JPG, PNG, WebP) or a PDF under 10 MB.'); return }
    setBusy(true); setProblem('')

    let receiptPath = null
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      receiptPath = `${userId}/${quote.id}/${newId()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(receiptPath, file, { upsert: false, contentType: file.type })
      if (upErr) { setBusy(false); setProblem('The receipt did not upload. Try again, or save the expense without it.'); return }
    }

    const { data, error } = await supabase.from('job_expenses').insert({
      freelancer_id: freelancerId,
      quote_id: quote.id,
      description: description.trim().slice(0, 200),
      amount: value,
      incurred_on: incurredOn,
      receipt_url: receiptPath,
      bill_to_client: billable && bill,
    }).select().single()
    setBusy(false)
    if (error) {
      if (receiptPath) supabase.storage.from('receipts').remove([receiptPath]).then(() => {})
      setProblem(/job_expenses/.test(error.message || '') && /exist|schema/.test(error.message || '')
        ? 'Expenses are still being switched on for the site. Try again shortly.'
        : `Could not save the expense. (${error.message})`)
      return
    }
    onChange([...expenses, data])
    reset(); setOpen(false)
    onNotice?.(`Expense of Bds$${money2(value)} logged${data.bill_to_client ? ', to be billed on the next invoice' : ''}.`)
  }

  async function toggleBill(e) {
    if (e.billed_invoice_number || !billable) return
    const next = !e.bill_to_client
    const { error } = await supabase.from('job_expenses').update({ bill_to_client: next }).eq('id', e.id)
    if (error) { onNotice?.('Could not change that expense. Please try again.', true); return }
    onChange(expenses.map(x => x.id === e.id ? { ...x, bill_to_client: next } : x))
  }

  async function remove(e) {
    if (!confirm(e.billed_invoice_number
      ? `Delete "${e.description}"? It stays on invoice ${e.billed_invoice_number}, which has already been sent; it only leaves your expenses.`
      : `Delete "${e.description}" (Bds$${money2(e.amount)})?`)) return
    const { error } = await supabase.from('job_expenses').delete().eq('id', e.id)
    if (error) { onNotice?.('Could not delete that expense. Please try again.', true); return }
    if (e.receipt_url) supabase.storage.from('receipts').remove([e.receipt_url]).then(() => {})
    onChange(expenses.filter(x => x.id !== e.id))
  }

  async function viewReceipt(e) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(e.receipt_url, 300)
    if (error || !data?.signedUrl) { onNotice?.('Could not open the receipt.', true); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed p-4 flex flex-col gap-3" style={{ borderColor: '#CBD5E1' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">Expenses <span className="text-xs font-normal text-gray-400">· only you can see these</span></span>
        {!open && (
          <button onClick={() => setOpen(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>
            + Add expense
          </button>
        )}
      </div>

      {/* Private profit summary */}
      <dl className="grid grid-cols-3 gap-2 text-xs tabular-nums">
        <div><dt className="text-gray-400">{p.invoicedYet ? 'Invoiced' : 'Quoted'}{p.toBill > 0 ? ' + to bill' : ''}</dt><dd className="font-semibold text-gray-800">Bds${money2(p.invoiced)}</dd></div>
        <div><dt className="text-gray-400">Expenses</dt><dd className="font-semibold text-gray-800">Bds${money2(p.expenses)}</dd></div>
        <div><dt className="text-gray-400">Profit</dt><dd className="font-bold" style={{ color: p.profit < 0 ? '#dc2626' : '#00267F' }}>Bds${money2(p.profit)}</dd></div>
      </dl>

      {/* When the billed costs actually reach the client. */}
      {p.toBill > 0 && (
        <p className="text-xs text-gray-500">
          {quote.status === 'sent'
            ? `Bds$${money2(p.toBill)} to bill goes on the invoice. The client has not accepted this quote yet; once they do, use Send invoice.`
            : quote.is_deposit && quote.invoice_number
            ? `Bds$${money2(p.toBill)} to bill goes on the balance invoice, which you can raise once the deposit is paid.`
            : `Bds$${money2(p.toBill)} to bill goes on the invoice when you send it.`}
        </p>
      )}

      {expenses.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-gray-100 pt-2">
          {expenses.map(e => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span className="min-w-0">
                {fmt(e.incurred_on)} · <span className="text-gray-800">{e.description}</span> · <span className="font-semibold tabular-nums">Bds${money2(e.amount)}</span>
                {e.receipt_url && <> · <button onClick={() => viewReceipt(e)} className="underline">receipt</button></>}
              </span>
              <span className="flex items-center gap-3">
                {e.billed_invoice_number ? (
                  <span className="font-medium" style={{ color: '#166534' }}>Billed on {e.billed_invoice_number}</span>
                ) : (
                  <label className={`flex items-center gap-1.5 ${billable ? 'cursor-pointer' : 'opacity-50'}`} title={billable ? 'Show this as a cost line on the next invoice' : 'The invoice has already been sent, so this stays internal'}>
                    <input type="checkbox" checked={!!e.bill_to_client} disabled={!billable} onChange={() => toggleBill(e)} />
                    Bill to client
                  </label>
                )}
                <button onClick={() => remove(e)} className="text-gray-400 hover:text-red-600">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
          <div>
            <label htmlFor={`exp-desc-${quote.id}`} className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <input id={`exp-desc-${quote.id}`} type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Copper pipe, 20 ft" className={fieldCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`exp-amount-${quote.id}`} className="block text-xs font-semibold text-gray-700 mb-1">Amount (Bds$)</label>
              <input id={`exp-amount-${quote.id}`} type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label htmlFor={`exp-date-${quote.id}`} className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
              <input id={`exp-date-${quote.id}`} type="date" value={incurredOn} max={todayKeyBarbados()} onChange={e => setIncurredOn(e.target.value)} className={fieldCls} />
            </div>
          </div>
          <div>
            <label htmlFor={`exp-receipt-${quote.id}`} className="block text-xs font-semibold text-gray-700 mb-1">Receipt photo <span className="text-gray-400 font-normal">(optional)</span></label>
            <input id={`exp-receipt-${quote.id}`} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs text-gray-600" />
          </div>
          <label className={`flex items-start gap-2 text-xs ${billable ? 'text-gray-700 cursor-pointer' : 'text-gray-400'}`}>
            <input type="checkbox" checked={billable && bill} disabled={!billable} onChange={e => setBill(e.target.checked)} className="mt-0.5" />
            <span>
              Bill to client
              <span className="block text-gray-400">
                {billable
                  ? (quote.is_deposit && quote.invoice_number ? 'Goes on the balance invoice as a cost line.' : 'Goes on the invoice as a cost line.')
                  : 'The invoice for this job has already been sent, so this expense stays internal.'}
              </span>
            </span>
          </label>
          {problem && <p role="alert" className="text-xs font-medium rounded-lg px-3 py-2" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>{problem}</p>}
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="text-xs font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>
              {busy ? 'Saving…' : 'Save expense'}
            </button>
            <button onClick={() => { reset(); setOpen(false) }} disabled={busy} className="text-xs font-medium text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
