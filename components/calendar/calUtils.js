// ── AST helpers ──────────────────────────────────────────────
// Barbados uses AST = UTC-4 year-round (no DST).
// All timestamps are stored as UTC in Supabase.
// These helpers convert between UTC JS Dates and AST wall-clock.

const AST_OFFSET_MS = 4 * 60 * 60 * 1000 // 4 hours in ms

/** Convert a UTC Date to an AST wall-clock Date object. */
export function toAST(date) {
  return new Date(new Date(date).getTime() - AST_OFFSET_MS)
}

/** Get current moment as an AST Date. */
export function nowAST() {
  return toAST(new Date())
}

/**
 * Create a UTC Date from AST wall-clock values.
 * month is 0-indexed (Jan = 0).
 */
export function astToUTC(year, month, day, hour, minute = 0) {
  // Date.UTC gives us UTC ms; adding 4 h converts AST→UTC
  return new Date(Date.UTC(year, month, day, hour + 4, minute))
}

// ── Calendar navigation ───────────────────────────────────────

/** Return the Monday of the week containing astDate. */
export function getWeekStart(astDate) {
  const d = new Date(astDate)
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Return array of 7 Date objects (Mon–Sun) from weekStart. */
export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/**
 * Return a 2D array of Date rows for a calendar month grid.
 * Always Mon-aligned. Rows cut off when month is done.
 */
export function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start of grid = Monday on or before firstDay
  const gridStart = new Date(firstDay)
  const dow = gridStart.getDay()
  gridStart.setDate(gridStart.getDate() - (dow === 0 ? 6 : dow - 1))

  const weeks = []
  const cur = new Date(gridStart)
  while (cur <= lastDay || (weeks.length < 4)) {
    if (weeks.length >= 6) break
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
    if (cur > lastDay && weeks.length >= 4) break
  }
  return weeks
}

// ── Display helpers ───────────────────────────────────────────

/** "Mon 14" */
export function formatDayHeader(date) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${DAYS[date.getDay()]} ${date.getDate()}`
}

/** "7am", "12pm", "3pm" */
export function formatHour(hour) {
  if (hour === 0) return '12am'
  if (hour < 12) return `${hour}am`
  if (hour === 12) return '12pm'
  return `${hour - 12}pm`
}

export function isToday(date) {
  const t = nowAST()
  return (
    date.getDate() === t.getDate() &&
    date.getMonth() === t.getMonth() &&
    date.getFullYear() === t.getFullYear()
  )
}

export function isSameDay(a, b) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Block overlap helpers ─────────────────────────────────────

/** True if block overlaps a 1-hour cell (cellDay at cellHour:00–cellHour+1:00 AST). */
export function blockCoversCell(block, cellDay, cellHour) {
  const start = toAST(new Date(block.start_time))
  const end = toAST(new Date(block.end_time))

  const cellStart = new Date(cellDay)
  cellStart.setHours(cellHour, 0, 0, 0)
  const cellEnd = new Date(cellDay)
  cellEnd.setHours(cellHour + 1, 0, 0, 0)

  return start < cellEnd && end > cellStart
}

/** True if block overlaps any part of a day (AST midnight–23:59). */
export function blockCoversDay(block, day) {
  const start = toAST(new Date(block.start_time))
  const end = toAST(new Date(block.end_time))

  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)

  return start <= dayEnd && end >= dayStart
}

// ── Service duration options ──────────────────────────────────

export const DURATION_OPTIONS = [
  { label: 'Not specified',  text: '',               minutes: null },
  { label: '30 minutes',     text: '30 minutes',     minutes: 30 },
  { label: '1 hour',         text: '1 hour',         minutes: 60 },
  { label: '1.5 hours',      text: '1.5 hours',      minutes: 90 },
  { label: '2 hours',        text: '2 hours',        minutes: 120 },
  { label: '3 hours',        text: '3 hours',        minutes: 180 },
  { label: '4 hours',        text: '4 hours',        minutes: 240 },
  { label: 'Half day',       text: 'Half day',       minutes: 270 },
  { label: 'Full day',       text: 'Full day',       minutes: 480 },
  { label: 'Multiple days',  text: 'Multiple days',  minutes: 0 },
]

export function formatDurationMinutes(minutes) {
  if (minutes === null || minutes === undefined) return ''
  if (minutes === 0) return 'Multiple days'
  if (minutes === 270) return 'Half day'
  if (minutes === 480) return 'Full day'
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} hr${minutes / 60 > 1 ? 's' : ''}`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
