// CSV export of quotes and invoices, for a professional's own records and
// for an organisation's. Pure functions only (no React, no database), so the
// rules are tested in tests/financialCsv.test.js.
//
// One saved row in `quotes` can be two documents: the quote, and the invoice
// it later became (same row, invoice_* columns set). The export lists them
// separately: a Quote line dated the day it was sent, and an Invoice line
// dated the day it was issued, carrying the quote's number as its link.
//
// A job with a deposit has two invoices on its row (lib/payments.js): the
// deposit and, later, the balance. Each is its own Invoice line, for its own
// amount, linked to the same quote.
//
// What the database does not record is left blank, never guessed:
//   VAT                  no VAT field exists anywhere; amounts are as charged,
//                        so net and gross are the same figure
//   Payment method/ref   blank unless payments were recorded against the
//                        invoice (SQL Section 44); several are joined with "; "
//   Quote "Date due"     a quote has no due date (only an invoice does)
//   draft / cancelled    no such states exist in the app
import { invoicesOf, invoiceBalance } from './payments.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Dates in Barbados time (UTC-4, no daylight saving), as YYYY-MM-DD. A
// timestamp from late evening in Barbados is already "tomorrow" in UTC.
export function dateKey(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const t = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`)
  if (!Number.isFinite(t)) return ''
  return new Date(t - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function todayKey(now = Date.now()) {
  return new Date(now - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / DAY_MS)
}

function addDaysKey(key, n) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

const money = n => (Number.isFinite(Number(n)) ? Number(n) : 0).toFixed(2)

function description(q) {
  const items = Array.isArray(q.items) ? q.items : []
  const first = items.find(i => i && String(i.description || '').trim())
  return first ? String(first.description).trim() : ''
}

function professionalName(f) {
  if (!f) return ''
  return (f.company_name || '').trim().length > 3 ? f.company_name.trim() : (f.name || '').trim()
}

/**
 * Turn saved quote rows into export records (a Quote record for each row,
 * plus an Invoice record when one was issued).
 * `extra(q)` adds side-specific fields (who the other party is, etc.).
 */
export function documentRecords(quotes, { today = todayKey(), extra = () => ({}), payments = {} } = {}) {
  const out = []
  for (const q of quotes || []) {
    if (!q) continue
    const amount = money(q.total)
    const common = {
      description: description(q),
      net: amount, vat: '', gross: amount,
      paymentMethod: '', paymentReference: '',
      ...extra(q),
    }
    const received = payments[q.id] || []

    const quoteIssued = dateKey(q.quote_date || q.created_at)
    if (q.quote_number || quoteIssued) {
      out.push({
        ...common,
        type: 'Quote',
        number: q.quote_number || '',
        issued: quoteIssued,
        due: '',
        paid: '',
        status: q.status === 'sent' ? 'sent' : q.status === 'declined' ? 'declined' : 'accepted',
        daysOverdue: '',
        linkedQuote: '',
      })
    }

    for (const inv of invoicesOf(q)) {
      const due = dateKey(inv.due)
      const { paid: paidSoFar, outstanding } = invoiceBalance(q, inv)
      const mine = received.filter(p => p.invoice_number === inv.number)
      const settled = outstanding <= 0
      // The day it was settled: the last payment against it, else the day the
      // job was marked paid.
      const paid = settled ? (mine.length ? dateKey(mine[mine.length - 1].received_on) : dateKey(q.paid_at)) : ''
      const overdue = !settled && due && due < today
      const join = key => [...new Set(mine.map(p => (p[key] || '').trim()).filter(Boolean))].join('; ')
      const invAmount = money(inv.amount)
      out.push({
        ...common,
        net: invAmount, gross: invAmount,
        type: 'Invoice',
        number: inv.number,
        issued: dateKey(inv.issued) || quoteIssued,
        due,
        paid,
        status: settled ? 'paid' : overdue ? 'overdue' : paidSoFar > 0 ? 'part-paid' : 'sent',
        daysOverdue: overdue ? String(daysBetween(due, today)) : '',
        paymentMethod: join('method'),
        paymentReference: join('reference'),
        linkedQuote: q.quote_number || '',
      })
    }
  }
  return out
}

/** For a professional: the other party is the client. */
export function freelancerRecords(quotes, opts = {}) {
  return documentRecords(quotes, {
    ...opts,
    extra: q => ({ partyName: q.client_name || '', partyEmail: q.client_email || '' }),
  })
}

/**
 * For an organisation: the other party is the professional, plus who on the
 * team raised it and the purchase order / reference number.
 * `contacts` maps freelancer id -> { email }; `raisedBy` maps message id -> name.
 */
export function organisationRecords(quotes, { contacts = new Map(), raisedBy = {}, ...opts } = {}) {
  return documentRecords(quotes, {
    ...opts,
    extra: q => ({
      partyName: professionalName(q.freelancers),
      partyEmail: contacts.get(q.freelancer_id)?.email || '',
      raisedBy: raisedBy[q.message_id] || '',
      poNumber: q.reference || '',
    }),
  })
}

/** Records issued between from and to (inclusive), of one type, newest first. */
export function selectRecords(records, { from = '', to = '', type = 'all' } = {}) {
  return (records || [])
    .filter(r => (type === 'all' || (type === 'invoices' ? r.type === 'Invoice' : r.type === 'Quote')))
    .filter(r => (!from || r.issued >= from) && (!to || r.issued <= to))
    .sort((a, b) =>
      b.issued.localeCompare(a.issued)
      || (a.type === b.type ? 0 : a.type === 'Invoice' ? -1 : 1)
      || b.number.localeCompare(a.number))
}

export const FREELANCER_COLUMNS = [
  ['Document type', 'type'], ['Document number', 'number'], ['Date issued', 'issued'], ['Date due', 'due'],
  ['Date paid', 'paid'], ['Client name', 'partyName'], ['Client email', 'partyEmail'], ['Description', 'description'],
  ['Amount net', 'net'], ['VAT', 'vat'], ['Amount gross', 'gross'], ['Status', 'status'], ['Days overdue', 'daysOverdue'],
  ['Payment method', 'paymentMethod'], ['Payment reference', 'paymentReference'], ['Linked quote number', 'linkedQuote'],
]

export const ORGANISATION_COLUMNS = [
  ['Document type', 'type'], ['Document number', 'number'], ['Date issued', 'issued'], ['Date due', 'due'],
  ['Date paid', 'paid'], ['Professional name', 'partyName'], ['Professional email', 'partyEmail'], ['Description', 'description'],
  ['Raised by', 'raisedBy'], ['PO number', 'poNumber'],
  ['Amount net', 'net'], ['VAT', 'vat'], ['Amount gross', 'gross'], ['Status', 'status'], ['Days overdue', 'daysOverdue'],
  ['Payment method', 'paymentMethod'], ['Payment reference', 'paymentReference'], ['Linked quote number', 'linkedQuote'],
]

// Fields that are text written by people: guarded even when the value looks
// like a number ("-5" as a reference stays text). Every OTHER cell is guarded
// too unless it is a plain number, so a file with columns not listed here
// (the expenses export, the year-end summary) is covered without being told.
const TEXT_FIELDS = new Set(['partyName', 'partyEmail', 'description', 'raisedBy', 'poNumber', 'number', 'linkedQuote', 'paymentMethod', 'paymentReference'])

export function csvCell(value, { text = false } = {}) {
  let s = value == null ? '' : String(value)
  // A cell starting with = + - @ is run as a formula by Excel and Sheets. A
  // client name like "=HYPERLINK(...)" must stay a name, so it gets a
  // leading apostrophe, the spreadsheet convention for "this is text".
  if (/^[=+\-@\t\r]/.test(s) && (text || !/^-?\d+(\.\d+)?$/.test(s))) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The whole file: UTF-8 byte order mark, header row, one line per record, no totals. */
export function buildCsv(records, columns) {
  const lines = [columns.map(([label]) => csvCell(label)).join(',')]
  for (const r of records) {
    lines.push(columns.map(([, key]) => csvCell(r[key], { text: TEXT_FIELDS.has(key) })).join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function exportFilename(from, to) {
  return `vetted-invoices-${from}-to-${to}.csv`
}

/** The quick presets, as { from, to } date keys. "All time" starts at the earliest record. */
export function presetRange(preset, { today = todayKey(), earliest = '' } = {}) {
  const year = today.slice(0, 4)
  if (preset === 'thisYear') return { from: `${year}-01-01`, to: today }
  if (preset === 'lastYear') { const y = String(Number(year) - 1); return { from: `${y}-01-01`, to: `${y}-12-31` } }
  if (preset === 'last90') return { from: addDaysKey(today, -89), to: today }
  if (preset === 'allTime') return { from: earliest && earliest < today ? earliest : today, to: today }
  return { from: `${year}-01-01`, to: today }
}
