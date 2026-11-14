// Automatic payment reminders: which unpaid invoice gets which reminder, and
// what the email says. Pure (tested in tests/paymentReminders.test.js); the
// daily job that sends them is app/api/cron/payment-reminders.
//
// All dates are Barbados days (AST, UTC-4, no daylight saving), so an invoice
// due "today" here never fires a day early on UTC's calendar.
//
// The stages, by days past the due date (negative = before it):
//
//   due_soon     3 to 1 days before      "due soon"
//   due_today    the due day to day 6    "due today" / "was due"
//   overdue_7    day 7 to day 13         "overdue"
//   overdue_14   day 14 to day 29        "overdue"
//   final        day 30 to day 59        the last one, then nothing more
//
// A stage is sent once per invoice. If a day is missed (the job did not run),
// the next run sends the stage the invoice is in now, not the ones it passed,
// so a client is never sent a backlog of reminders at once.
//
// What has already been sent is read from payment_reminder_log (`history`),
// which only the job can write. The stamps on the quote's own row
// (reminder_stage, last_reminder_sent) are for display: the professional can
// change their own row, so nothing is decided from them when the job runs.
//
// Limits that keep the job from being turned on people:
//   - a series never STARTS on an invoice already 14 or more days overdue
//     (so switching reminders on does not email every old unpaid invoice,
//     some of which were paid in cash and never ticked);
//   - nothing is sent once an invoice is 60 or more days overdue;
//   - a failed send is tried again on later days, three times per stage;
//   - at most MAX_PER_JOB reminders ever go out for one job.
import { escapeHtml } from './escapeHtml.js'
import { invoiceToPay, invoiceBalance, amountPaid, money2 } from './payments.js'
import { fmtInvoiceDate } from './invoicing.js'

export const STAGES = [
  { key: 'due_soon', from: -3, to: -1 },
  { key: 'due_today', from: 0, to: 6 },
  { key: 'overdue_7', from: 7, to: 13 },
  { key: 'overdue_14', from: 14, to: 29 },
  { key: 'final', from: 30, to: 59 },
]
// A first reminder is never sent later than this many days past due.
export const START_BY_DAY = 13
// Two invoices (deposit, balance) of five stages each.
export const MAX_PER_JOB = 10
// A send that failed is retried on later days, this many times per stage.
export const MAX_FAILED_TRIES = 3
// The professional hears about these only; the earlier ones are noise to them.
export const PRO_STAGES = new Set(['overdue_7', 'overdue_14', 'final'])
const DAY_MS = 24 * 60 * 60 * 1000

/** Today in Barbados as YYYY-MM-DD. */
export function barbadosToday(nowMs = Date.now()) {
  return new Date(nowMs - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Whole days from one YYYY-MM-DD to another (negative if `to` is earlier). */
export function daysFrom(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / DAY_MS)
}

export function stageFor(daysPastDue) {
  return STAGES.find(s => daysPastDue >= s.from && daysPastDue <= s.to) || null
}

const stageIndex = key => STAGES.findIndex(s => s.key === key)

/**
 * Should this invoice get a reminder today? Returns { send: false, reason }
 * or { send: true, stage, invoice, outstanding, daysPastDue, notifyPro }.
 * `quote` is a quotes row with its professional embedded as `freelancers`.
 */
export function decideReminder(quote, { nowMs = Date.now(), history } = {}) {
  const no = reason => ({ send: false, reason })
  const q = quote || {}
  const today = barbadosToday(nowMs)

  if (!q.invoice_number) return no('not invoiced')
  if (q.paid_at || !['invoiced', 'completed'].includes(q.status)) return no('paid or not open')
  if (q.freelancers && q.freelancers.payment_reminders_enabled === false) return no('reminders off for this professional')
  if (q.reminders_paused) return no('paused on this invoice')

  const invoice = invoiceToPay(q)
  if (!invoice) return no('no invoice')
  const { outstanding } = invoiceBalance(q, invoice)
  // A paid deposit whose balance has not been invoiced yet: nothing is due.
  if (!(outstanding > 0)) return no('nothing outstanding on the current invoice')

  const issued = Date.parse(invoice.issued || '')
  if (!Number.isFinite(issued) || nowMs - issued < DAY_MS) return no('sent less than 24 hours ago')
  if (!invoice.due) return no('no due date')

  const daysPastDue = daysFrom(invoice.due, today)
  if (!Number.isFinite(daysPastDue)) return no('no due date')
  const stage = stageFor(daysPastDue)
  if (!stage) return no(daysPastDue > 0 ? 'more than 60 days overdue' : 'not due yet')

  if (Array.isArray(history)) {
    // The job's own record of what went out for this job (never dry runs).
    const sent = history.filter(h => h && !h.error)
    if (history.some(h => h?.sent_on === today)) return no('already reminded today')
    if (sent.length >= MAX_PER_JOB) return no('reminder limit reached for this job')
    // A new invoice (the balance after a deposit) starts its own stages.
    const mine = history.filter(h => h?.invoice_number === invoice.number)
    const done = key => mine.some(h => h.stage === key && !h.error)
      || mine.filter(h => h.stage === key && h.error).length >= MAX_FAILED_TRIES
    const reached = STAGES.reduce((top, s, i) => (done(s.key) ? i : top), -1)
    if (reached >= stageIndex(stage.key)) return no('this stage already sent')
    if (mine.length === 0 && daysPastDue > START_BY_DAY) return no('too far overdue to start reminders')
  } else {
    // No log to read (unit tests, previews): the stamps on the row.
    if (q.last_reminder_sent === today) return no('already reminded today')
    const stamp = String(q.reminder_stage || '')
    const cut = stamp.lastIndexOf(':')
    const lastInvoice = cut >= 0 ? stamp.slice(0, cut) : ''
    const lastStage = cut >= 0 ? stamp.slice(cut + 1) : ''
    if (lastInvoice === invoice.number && stageIndex(lastStage) >= stageIndex(stage.key)) return no('this stage already sent')
  }

  return { send: true, stage: stage.key, invoice, outstanding, daysPastDue, notifyPro: PRO_STAGES.has(stage.key) }
}

function professionalName(f) {
  return (f?.company_name || '').trim().length > 3 ? f.company_name.trim() : (f?.name || 'Your professional')
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Subject and HTML for the client's reminder email. */
export function reminderEmail(quote, decision, { siteUrl = 'https://vetted.bb', siteHost = 'vetted.bb', greeting = 'Hi' } = {}) {
  const { stage, invoice, outstanding, daysPastDue } = decision
  const pro = professionalName(quote.freelancers)
  const due = fmtInvoiceDate(invoice.due)
  const what = invoice.kind === 'deposit' ? 'deposit invoice' : invoice.kind === 'balance' ? 'balance invoice' : 'invoice'
  const amount = `Bds$${money2(outstanding)}`

  const when = stage === 'due_soon' ? `is due on ${due}, in ${plural(-daysPastDue, 'day')}`
    : stage === 'due_today' ? (daysPastDue === 0 ? 'is due today' : `was due on ${due}`)
    : `is ${plural(daysPastDue, 'day')} overdue (it was due on ${due})`

  const subject = stage === 'final'
    ? `Final reminder: ${what} ${invoice.number} from ${pro} is ${plural(daysPastDue, 'day')} overdue`
    : stage === 'due_soon' ? `Reminder: ${what} ${invoice.number} from ${pro} is due on ${due}`
    : stage === 'due_today' ? `${what[0].toUpperCase()}${what.slice(1)} ${invoice.number} from ${pro} ${daysPastDue === 0 ? 'is due today' : 'is now due'}`
    : `${what[0].toUpperCase()}${what.slice(1)} ${invoice.number} from ${pro} is ${plural(daysPastDue, 'day')} overdue`

  const paidSoFar = amountPaid(quote)
  const partPaid = paidSoFar > 0
  const esc = escapeHtml
  const row = (label, value, strong = false) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">${esc(label)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:14px;${strong ? 'font-weight:700;color:#00267F' : 'color:#111827'}">${esc(value)}</td>
    </tr>`
  const details = String(quote.freelancers?.payment_details || '').trim()

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
      <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #00267F; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
          <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">${stage === 'final' ? 'Final payment reminder' : 'Payment reminder'}</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">${esc(greeting)},</p>
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
            A friendly reminder that ${esc(what)} <strong>${esc(invoice.number)}</strong> from <strong>${esc(pro)}</strong> ${esc(when)}.
            ${stage === 'final' ? ' This is the last reminder we will send about it.' : ''}
          </p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
            ${row('Invoice', invoice.number)}
            ${row('Due date', due)}
            ${partPaid ? row('Invoice total', `Bds$${money2(invoice.amount)}`) : ''}
            ${partPaid ? row('Already paid', `Bds$${money2(invoice.amount - outstanding)}`) : ''}
            ${row(partPaid ? 'Still to pay' : 'Amount due', amount, true)}
          </table>
          ${details ? `
          <div style="background:#f9fafb;border-left:3px solid #00267F;border-radius:8px;padding:14px 16px;margin:0 0 20px">
            <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px">How to pay ${esc(pro)}</p>
            <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${esc(details)}</p>
          </div>` : ''}
          <a href="${siteUrl}/messages" style="display:block;background:#00267F;color:white;text-align:center;padding:14px 24px;border-radius:100px;text-decoration:none;font-weight:600;font-size:14px">View the invoice →</a>
          <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:18px 0 0">
            Already paid? Thank you, and please ignore this. If you have arranged something else with ${esc(pro)}, reply to them in your messages.
            Payment goes to ${esc(pro)} directly; Vetted.bb does not take payments.
          </p>
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">Vetted.bb · Connecting Barbados · <a href="${siteUrl}" style="color: #00267F;">${esc(siteHost)}</a></p>
        </div>
      </div>
    </div>`
  return { subject, html }
}

/** The professional's notification at 7, 14 and 30 days overdue. */
export function proNotice(quote, decision) {
  const who = quote.client_name || 'your client'
  const { invoice, outstanding, daysPastDue, stage } = decision
  return {
    type: 'reminder',
    title: `Invoice ${invoice.number} to ${who} is ${plural(daysPastDue, 'day')} overdue`,
    body: `Bds$${money2(outstanding)} outstanding. ${stage === 'final' ? 'A final reminder was emailed to them; no more will be sent.' : 'A reminder was emailed to them.'}`,
    link: '/quotes',
  }
}
