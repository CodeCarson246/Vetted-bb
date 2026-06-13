// Single source of truth for invoice/quote payment terms — used by the
// quote builder, both invoice senders, the PDF, and the outstanding-
// payments view. `reminderAt` is the days-remaining threshold at or
// below which a "send payment reminder" prompt appears for the freelancer.
export const PAYMENT_TERMS = [
  { value: 'due_receipt', label: 'Due on receipt', days: 0,  reminderAt: 0 },
  { value: 'net7',        label: 'Net 7 days',     days: 7,  reminderAt: 2 },
  { value: 'net14',       label: 'Net 14 days',    days: 14, reminderAt: 7 },
  { value: 'net30',       label: 'Net 30 days',    days: 30, reminderAt: 14 },
  { value: 'net60',       label: 'Net 60 days',    days: 60, reminderAt: 30 },
]

const byValue = Object.fromEntries(PAYMENT_TERMS.map(t => [t.value, t]))

export function termDays(value) {
  return byValue[value]?.days ?? 14
}

export function termLabel(value) {
  return byValue[value]?.label ?? value
}

export function reminderThreshold(value) {
  return byValue[value]?.reminderAt ?? 7
}

// Whole days from today (local) until a YYYY-MM-DD due date. Negative = overdue.
export function daysUntil(dueDateStr) {
  if (!dueDateStr) return null
  const [y, m, d] = dueDateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const due = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due - today) / 86400000)
}
