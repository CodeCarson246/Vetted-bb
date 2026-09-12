'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganisation } from '@/lib/useOrganisation'
import { currencySymbol } from '@/lib/organisations'
import { formatVerifyCode } from '@/lib/verifyCode'
import { termLabel } from '@/lib/paymentTerms'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const STATUS_LABELS = { sent: 'Awaiting decision', accepted: 'Accepted', declined: 'Declined', invoiced: 'Invoiced', completed: 'Completed', paid: 'Paid' }
const STATUS_STYLES = {
  sent:      { backgroundColor: '#FEF3C7', color: '#92400E' },
  accepted:  { backgroundColor: '#DCFCE7', color: '#166534' },
  declined:  { backgroundColor: '#FEE2E2', color: '#991B1B' },
  invoiced:  { backgroundColor: '#EEF2FF', color: '#00267F' },
  completed: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  paid:      { backgroundColor: '#DCFCE7', color: '#166534' },
}
const selectCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

const fmtDate = (v) => {
  if (!v) return ''
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
const money = (sym, n) => `${sym}${Number(n || 0).toFixed(2)}`
const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Every quote and invoice the organisation has received, filterable and
// exportable: the audit answer in one click. Paid totals are spend;
// accepted/invoiced/completed are committed but not yet paid.
export default function OrganisationRecords() {
  const { org, loading } = useOrganisation()
  const [rows, setRows] = useState([])
  const [ready, setReady] = useState(false)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [pro, setPro] = useState('all')
  const [member, setMember] = useState('all')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    if (loading || !org) return
    let cancelled = false
    ;(async () => {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('*, freelancers(id, name, company_name, trade)')
        .eq('organisation_id', org.id)
        .order('created_at', { ascending: false })
      const qs = quotes || []
      const msgIds = [...new Set(qs.map(q => q.message_id).filter(Boolean))]
      const reqIds = [...new Set(qs.map(q => q.quote_request_id).filter(Boolean))]
      const [{ data: msgs }, { data: reqs }] = await Promise.all([
        msgIds.length ? supabase.from('messages').select('id, sender_name, sender_user_id').in('id', msgIds) : Promise.resolve({ data: [] }),
        reqIds.length ? supabase.from('quote_requests').select('id, title').in('id', reqIds) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const byMsg = Object.fromEntries((msgs || []).map(m => [m.id, m]))
      const byReq = Object.fromEntries((reqs || []).map(r => [r.id, r]))
      setRows(qs.map(q => {
        const f = q.freelancers || {}
        const date = q.quote_date || (q.created_at || '').slice(0, 10)
        return {
          id: q.id,
          quote_number: q.quote_number || '',
          invoice_number: q.invoice_number || '',
          date,
          year: date.slice(0, 4),
          month: date.slice(5, 7),
          professional: (f.company_name || '').trim().length > 3 ? f.company_name : (f.name || 'Professional'),
          trade: f.trade || '',
          requestedBy: byMsg[q.message_id]?.sender_name || '',
          requestTitle: byReq[q.quote_request_id]?.title || '',
          status: q.status,
          currency: q.currency || 'BBD',
          total: Number(q.total) || 0,
          terms: termLabel(q.invoice_terms || q.payment_terms),
          invoiced_at: q.invoiced_at,
          paid_at: q.paid_at,
          reference: q.reference || '',
          verify_code: q.verify_code || '',
        }
      }))
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [loading, org])

  const yearOptions = useMemo(() => [...new Set(rows.map(r => r.year).filter(Boolean))].sort().reverse(), [rows])
  const proOptions = useMemo(() => [...new Set(rows.map(r => r.professional))].sort(), [rows])
  const memberOptions = useMemo(() => [...new Set(rows.map(r => r.requestedBy).filter(Boolean))].sort(), [rows])

  const filtered = rows.filter(r =>
    (year === 'all' || r.year === year)
    && (month === 'all' || r.month === month)
    && (pro === 'all' || r.professional === pro)
    && (member === 'all' || r.requestedBy === member)
    && (status === 'all' || r.status === status)
  )
  const hasFilter = year !== 'all' || month !== 'all' || pro !== 'all' || member !== 'all' || status !== 'all'
  const sym = currencySymbol(filtered[0]?.currency)

  const paid = filtered.filter(r => r.status === 'paid')
  const committed = filtered.filter(r => ['accepted', 'invoiced', 'completed'].includes(r.status))
  const sum = list => list.reduce((s, r) => s + r.total, 0)

  const groupSum = (list, keyFn) => {
    const m = {}
    for (const r of list) { const k = keyFn(r); m[k] = (m[k] || 0) + r.total }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }
  const byMonth = groupSum(paid, r => (r.paid_at || r.date).slice(0, 7)).sort((a, b) => b[0].localeCompare(a[0]))
  const byPro = groupSum(paid, r => r.professional)
  const byMember = groupSum(paid, r => r.requestedBy || 'Unknown')

  function exportCsv() {
    const header = ['Quote no.', 'Invoice no.', 'Date', 'Professional', 'Trade', 'Requested by', 'Request', 'Status', 'Currency', 'Total', 'Terms', 'Invoiced', 'Paid', 'Reference', 'Verification code']
    const lines = filtered.map(r => [
      r.quote_number, r.invoice_number, r.date, r.professional, r.trade, r.requestedBy, r.requestTitle,
      STATUS_LABELS[r.status] || r.status, r.currency, r.total.toFixed(2), r.terms,
      r.invoiced_at ? r.invoiced_at.slice(0, 10) : '', r.paid_at ? r.paid_at.slice(0, 10) : '', r.reference, formatVerifyCode(r.verify_code),
    ].map(csvCell).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = (org.name || 'organisation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    a.download = `vetted-records-${slug}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading || !org) {
    return <main className="min-h-screen page-bg flex items-center justify-center"><p className="text-sm text-gray-400">Loading…</p></main>
  }

  return (
    <main className="min-h-screen page-bg">
      {/* Print: drop the chrome and filters, keep the summary and the table. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          aside, header, .no-print { display: none !important; }
          .md\\:ml-\\[244px\\] { margin-left: 0 !important; }
          main { background: white !important; }
          .print-full { max-width: none !important; padding: 0 !important; }
          .bg-white { box-shadow: none !important; border-color: #e5e7eb !important; }
        }
      ` }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 print-full">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Records</h1>
            <p className="text-sm text-gray-500">Every quote and invoice received by {org.name}. Filter, then export or print for your files.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 no-print">
            <button onClick={() => window.print()} disabled={!ready || filtered.length === 0} className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors hover:border-gray-400 disabled:opacity-50" style={{ borderColor: '#00267F', color: '#00267F' }}>Print / PDF</button>
            <button onClick={exportCsv} disabled={!ready || filtered.length === 0} className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#00267F' }}>Export CSV</button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 mb-4 no-print">
          <div className="flex flex-wrap gap-2 items-center">
            <select className={selectCls} value={year} onChange={e => setYear(e.target.value)}>
              <option value="all">All years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={selectCls} value={month} onChange={e => setMonth(e.target.value)}>
              <option value="all">All months</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
            <select className={selectCls} value={pro} onChange={e => setPro(e.target.value)}>
              <option value="all">All professionals</option>
              {proOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className={selectCls} value={member} onChange={e => setMember(e.target.value)}>
              <option value="all">Requested by anyone</option>
              {memberOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">Any status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {hasFilter && <button onClick={() => { setYear('all'); setMonth('all'); setPro('all'); setMember('all'); setStatus('all') }} className="text-xs font-medium text-gray-400 hover:text-gray-600">✕ Clear</button>}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Paid', value: money(sym, sum(paid)), sub: `${paid.length} invoice${paid.length === 1 ? '' : 's'}`, accent: '#16a34a' },
            { label: 'Committed, not yet paid', value: money(sym, sum(committed)), sub: `${committed.length} job${committed.length === 1 ? '' : 's'}`, accent: '#00267F' },
            { label: 'Awaiting decision', value: String(filtered.filter(r => r.status === 'sent').length), sub: 'quotes to review', accent: '#F9C000' },
            { label: 'Declined', value: String(filtered.filter(r => r.status === 'declined').length), sub: 'quotes', accent: '#9ca3af' },
          ].map(t => (
            <div key={t.label} className="bg-white rounded-2xl border border-gray-100 p-5" style={{ borderTop: `3px solid ${t.accent}` }}>
              <p className="text-2xl font-bold text-gray-900 tabular-nums" style={{ fontFamily: "'Sora', sans-serif" }}>{ready ? t.value : '…'}</p>
              <p className="text-sm text-gray-500 mt-1">{t.label}</p>
              <p className="text-xs text-gray-400">{t.sub}</p>
            </div>
          ))}
        </div>

        {/* Breakdowns of paid spend */}
        {ready && paid.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {[['By month', byMonth.map(([k, v]) => [`${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, v])], ['By professional', byPro], ['By team member', byMember]].map(([title, list]) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
                <ul className="flex flex-col gap-2">
                  {list.slice(0, 8).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-700 truncate">{k}</span>
                      <span className="font-semibold tabular-nums flex-shrink-0" style={{ color: '#00267F' }}>{money(sym, v)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {!ready ? (
            <p className="px-6 py-8 text-sm text-gray-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-6 py-10 text-sm text-gray-500 text-center">{rows.length === 0 ? 'No quotes yet. They appear here as soon as a professional sends one.' : 'Nothing matches these filters.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Professional</th>
                    <th className="px-4 py-3">Requested by</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-900">{r.invoice_number || r.quote_number}</p>
                        {r.invoice_number && <p className="font-mono text-[10px] text-gray-400">{r.quote_number}</p>}
                        {r.reference && <p className="text-[10px] text-gray-400">Ref. {r.reference}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.professional}</p>
                        <p className="text-xs text-gray-400">{r.trade}{r.requestTitle ? ` · ${r.requestTitle}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.requestedBy || ''}</td>
                      <td className="px-4 py-3"><span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={STATUS_STYLES[r.status] || STATUS_STYLES.sent}>{STATUS_LABELS[r.status] || r.status}</span></td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: '#00267F' }}>{money(currencySymbol(r.currency), r.total)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.paid_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{formatVerifyCode(r.verify_code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Totals are what professionals have invoiced {org.name} through Vetted.bb, as they recorded it. <Link href="/verify" className="font-semibold" style={{ color: '#00267F' }}>Verify any document</Link> with its code.
        </p>
      </div>
    </main>
  )
}
