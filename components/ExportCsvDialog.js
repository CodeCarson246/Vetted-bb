'use client'
import { useMemo, useState } from 'react'
import { selectRecords, buildCsv, exportFilename, presetRange, todayKey } from '@/lib/financialCsv'

// "Export CSV": quotes and invoices for a chosen date range, as a file a
// spreadsheet or an accountant can open. Used on Quotes & earnings (a
// professional) and on Records (an organisation). The page hands over its
// records already built (lib/financialCsv); this only filters and saves.
const PRESETS = [
  ['thisYear', 'This year'],
  ['lastYear', 'Last year'],
  ['last90', 'Last 90 days'],
  ['allTime', 'All time'],
]
const TYPES = [
  ['all', 'All'],
  ['invoices', 'Invoices only'],
  ['quotes', 'Quotes only'],
]
const LARGE = 1000

const fieldCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white'

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// secondFile (optional): another set of records saved as its own file for
// the same dates, e.g. a professional's expenses next to their invoices.
//   { label, prefix, columns, records }   records need an `issued` date key
export default function ExportCsvDialog({ open, onClose, records, columns, note, secondFile = null }) {
  const today = todayKey()
  const earliest = useMemo(
    () => (records || []).reduce((min, r) => (r.issued && (!min || r.issued < min) ? r.issued : min), ''),
    [records],
  )
  const initial = presetRange('thisYear', { today })
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [preset, setPreset] = useState('thisYear')
  const [type, setType] = useState('all')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [withSecond, setWithSecond] = useState(false)

  if (!open) return null

  function choosePreset(p) {
    const r = presetRange(p, { today, earliest })
    setPreset(p); setFrom(r.from); setTo(r.to); setNotice('')
  }

  async function exportNow() {
    if (busy) return
    if (from && to && from > to) { setNotice('The From date is after the To date.'); return }
    const chosen = selectRecords(records, { from, to, type })
    if (chosen.length === 0) {
      setNotice('No records found for that date range')
      setTimeout(() => setNotice(''), 3500)
      return
    }
    setNotice('')
    if (chosen.length > LARGE) {
      setBusy(true)
      // Let "Preparing…" paint before the work starts.
      await new Promise(r => setTimeout(r, 30))
    }
    try {
      const fromKey = from || earliest || today, toKey = to || today
      download(buildCsv(chosen, columns), exportFilename(fromKey, toKey))
      if (secondFile && withSecond) {
        const second = selectRecords(secondFile.records, { from, to })
        if (second.length) download(buildCsv(second, secondFile.columns), `${secondFile.prefix}-${fromKey}-to-${toKey}.csv`)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6" role="dialog" aria-modal="true" aria-labelledby="export-csv-title" onClick={e => e.stopPropagation()}>
        <h3 id="export-csv-title" className="font-bold text-gray-900 text-lg" style={{ fontFamily: 'var(--font-display)' }}>Export CSV</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Quotes and invoices issued in the dates you choose, newest first.{note ? ` ${note}` : ''}
        </p>

        <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Quick ranges">
          {PRESETS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => choosePreset(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${preset === value ? '' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
              style={preset === value ? { backgroundColor: '#F9C000', color: '#00267F' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label htmlFor="export-from" className="block text-xs font-semibold text-gray-700 mb-1">From</label>
            <input id="export-from" type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPreset(''); setNotice('') }} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="export-to" className="block text-xs font-semibold text-gray-700 mb-1">To</label>
            <input id="export-to" type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPreset(''); setNotice('') }} className={fieldCls} />
          </div>
        </div>

        <label htmlFor="export-type" className="block text-xs font-semibold text-gray-700 mt-4 mb-1">Type</label>
        <select id="export-type" value={type} onChange={e => { setType(e.target.value); setNotice('') }} className={fieldCls}>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>

        {secondFile && (
          <label className="flex items-start gap-2 mt-4 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" id="export-second-file" checked={withSecond} onChange={e => setWithSecond(e.target.checked)} className="mt-1" />
            <span>{secondFile.label}</span>
          </label>
        )}

        {notice && (
          <p role="status" className="mt-4 text-sm font-medium rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            {notice}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={exportNow}
            disabled={busy}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
          >
            {busy ? 'Preparing…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
