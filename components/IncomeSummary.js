'use client'
import { useMemo, useState } from 'react'
import { incomeSummary, reportYears, summaryLabels, monthColumns, monthRows, otherCurrencyNote, DISCLAIMER } from '@/lib/incomeSummary'
import { buildCsv } from '@/lib/financialCsv'
import { downloadReportPdf } from '@/lib/printQuote'

const money = n => `Bds$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * The year-end summary, for a professional (money in) or an organisation
 * (money out). Figures only: nothing here works out tax.
 *
 * data:      { quotes, payments, expenses } already loaded by the page
 * thisYear:  the current Barbados year, as a string
 * side:      'professional' | 'organisation'
 * organisationId: for the organisation's PDF
 *
 * The on-screen figures come from `data`; the PDF's are worked out again on
 * the server from the database (lib/incomeSummary.js both times).
 */
export default function IncomeSummary({ data, thisYear, side = 'professional', organisationId }) {
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const pro = side === 'professional'
  const l = summaryLabels(side)

  const years = useMemo(() => (data && thisYear ? reportYears(data, thisYear) : []), [data, thisYear])
  const year = chosen || thisYear
  const s = useMemo(() => (data && year ? incomeSummary(data, year, side) : null), [data, year, side])

  if (!s) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-6"><p className="text-sm text-gray-400">Loading…</p></div>
  }

  const empty = !s.invoiceCount && !s.received && !s.expenses
  const tiles = [
    [l.invoiced, money(s.invoiced), 'Invoices issued in the year'],
    [l.outstanding, money(s.outstanding), 'Still unpaid on those invoices today'],
    ...(pro ? [['Expenses logged', money(s.expenses), 'Costs you logged against jobs']] : []),
    ...(pro ? [['Net', money(s.net), 'Received minus expenses']] : []),
    ['Invoices issued', String(s.invoiceCount), ''],
    [l.parties, String(s.parties), pro ? 'Different clients invoiced' : 'Different professionals'],
    ['Average invoice', money(s.average), ''],
  ]

  const pdf = async () => {
    setBusy(true); setPdfError('')
    const ok = await downloadReportPdf({ year: s.year, side, ...(organisationId ? { organisationId } : {}) })
    setBusy(false)
    if (!ok) setPdfError('The PDF could not be made just now. Check your connection and try again.')
  }
  const csv = () => downloadCsv(buildCsv(monthRows(s), monthColumns(side)), `Vetted-${pro ? 'income' : 'spending'}-summary-${s.year}.csv`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="report-year" className="text-sm text-gray-500">Year</label>
        <select
          id="report-year"
          value={s.year}
          onChange={e => setChosen(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white outline-none focus:border-gray-400"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-2 ml-auto">
          <button onClick={pdf} disabled={busy} className="text-sm font-semibold px-4 py-2 rounded-full border transition-colors hover:border-gray-400 disabled:opacity-50" style={{ borderColor: '#00267F', color: '#00267F' }}>
            {busy ? 'Preparing…' : 'Download as PDF'}
          </button>
          <button onClick={csv} className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90" style={{ backgroundColor: '#00267F' }}>
            Download as CSV
          </button>
        </div>
      </div>
      {pdfError && <p className="text-sm text-red-600" role="alert">{pdfError}</p>}

      {/* The headline: cash basis, labelled so it cannot be misread. */}
      <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: '#EEF2FF' }}>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{l.headline} in {s.year} (cash basis)</p>
        <p className="text-3xl sm:text-4xl font-bold tabular-nums mt-1" style={{ color: '#00267F', fontFamily: 'var(--font-display)' }}>{money(s.received)}</p>
        <p className="text-xs text-gray-500 mt-1">{l.headlineNote}</p>
      </div>

      {empty && (
        <p className="text-sm text-gray-500">Nothing was invoiced{pro ? ', received or logged' : ' or paid'} in {s.year}.</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-1 text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="font-semibold px-4 sm:px-5 py-3">Month</th>
                <th className="font-semibold px-3 py-3 text-right">Invoiced</th>
                <th className="font-semibold px-3 py-3 text-right">{l.received}</th>
                {pro && <th className="font-semibold px-4 sm:px-5 py-3 text-right">Expenses</th>}
              </tr>
            </thead>
            <tbody>
              {s.months.map(m => (
                <tr key={m.month} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 sm:px-5 py-2.5 text-gray-700">{m.month}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{money(m.invoiced)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{money(m.received)}</td>
                  {pro && <td className="px-4 sm:px-5 py-2.5 text-right tabular-nums text-gray-600">{money(m.expenses)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {otherCurrencyNote(s) && <p className="text-xs text-gray-500">{otherCurrencyNote(s)}</p>}
      <p className="text-xs text-gray-400 leading-relaxed">{DISCLAIMER}</p>
    </div>
  )
}
