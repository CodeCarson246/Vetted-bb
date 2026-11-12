'use client'
import { useMemo, useState } from 'react'
import { addDays, takenDaySet, fmtDay } from '@/lib/rentals'

// Pick a run of dates for ONE rental item, with the days it is already out
// greyed and unpickable. A native date input cannot show that, and it is the
// whole point: the customer sees what is free before asking.
//
// unit 'day':   first and last day, both included. Tapping one day twice is a
//               single-day hire.
// unit 'night': check-in then check-out. The check-out day may be a day
//               someone else arrives, because the item is free by then.
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const keyOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function RentalDatePicker({ unit = 'day', taken = [], minDate, start, end, onChange }) {
  const night = unit === 'night'
  const takenDays = useMemo(() => takenDaySet(taken), [taken])
  const [view, setView] = useState(() => {
    const base = start || minDate
    return { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }
  })

  const picking = start && !end // waiting for the second date
  // The furthest second date reachable from `start` without crossing a day
  // the item is out.
  const lastReachable = useMemo(() => {
    if (!start) return null
    let d = start
    for (let i = 0; i < 366; i++) {
      const next = addDays(d, 1)
      if (takenDays.has(next)) return night ? next : d
      d = next
    }
    return d
  }, [start, takenDays, night])

  const canStart = k => k >= minDate && !takenDays.has(k)
  const canEnd = k => !!start && (night ? k > start : k >= start) && k <= lastReachable

  function pick(k) {
    if (picking && canEnd(k)) { onChange({ start, end: k }); return }
    if (canStart(k)) onChange({ start: k, end: null })
  }

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const lead = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => keyOf(view.y, view.m, i + 1))]

  const minMonth = { y: Number(minDate.slice(0, 4)), m: Number(minDate.slice(5, 7)) - 1 }
  const atMin = view.y === minMonth.y && view.m === minMonth.m
  const shift = dir => setView(v => {
    const m = v.m + dir
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
  })

  const hint = !start
    ? (night ? 'Pick your check-in date.' : 'Pick the first day you need it.')
    : picking
    ? (night ? 'Now pick your check-out date.' : 'Now pick the last day. Tap the same day for a one-day hire.')
    : `${fmtDay(start)} to ${fmtDay(end)}. Tap any date to start again.`

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} disabled={atMin} aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-semibold text-gray-900" aria-live="polite">{MONTHS[view.m]} {view.y}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
        {DOW.map((d, i) => <span key={i} className="text-[11px] font-semibold text-gray-400 py-1" aria-hidden="true">{d}</span>)}
        {cells.map((k, i) => {
          if (!k) return <span key={`b${i}`} />
          const isTaken = takenDays.has(k)
          const isStart = k === start
          const isEnd = k === end
          const inRange = start && end && k > start && k < end
          const enabled = picking ? (canEnd(k) || canStart(k)) : canStart(k)
          const endpoint = isStart || isEnd
          // A taken day stays visibly taken even when it can be a check-out.
          const style = endpoint
            ? { backgroundColor: '#00267F', color: '#fff', fontWeight: 700 }
            : inRange
            ? { backgroundColor: 'var(--selected-fill)', color: 'var(--accent)', fontWeight: 600 }
            : isTaken
            ? { color: 'var(--muted)', opacity: enabled ? 0.75 : 0.45, textDecoration: 'line-through', backgroundColor: 'var(--row-stripe)' }
            : enabled
            ? { color: 'var(--foreground)' }
            : { color: 'var(--muted)', opacity: 0.35 }
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              disabled={!enabled}
              onClick={() => pick(k)}
              aria-label={`${fmtDay(k)}${isTaken ? ', unavailable' : ''}${isStart ? ', start' : ''}${isEnd ? ', end' : ''}`}
              aria-pressed={endpoint || !!inRange}
              className="h-9 text-sm tabular-nums"
              style={{
                border: 'none',
                cursor: enabled ? 'pointer' : 'default',
                borderRadius: isStart && end && !isEnd ? '8px 0 0 8px' : isEnd && !isStart ? '0 8px 8px 0' : inRange ? 0 : 8,
                backgroundColor: 'transparent',
                ...style,
              }}
            >
              {Number(k.slice(8))}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-xs text-gray-500">{hint}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 flex-shrink-0">
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: 'var(--row-stripe)', border: '1px solid var(--border-card)' }} />
          Unavailable
        </span>
      </div>
    </div>
  )
}
