import test from 'node:test'
import assert from 'node:assert/strict'
import { decideReminder, stageFor, barbadosToday, daysFrom, reminderEmail, proNotice } from '../lib/paymentReminders.js'

// "Now" helpers: a Barbados calendar day at a given Barbados hour.
const at = (day, hour = 9) => Date.parse(`${day}T${String(hour + 4).padStart(2, '0')}:00:00Z`)
const pro = { name: 'Carson Pitts', company_name: '', payment_details: 'Bank transfer to C. Pitts, acct 1234', payment_reminders_enabled: true }
const inv = (extra = {}) => ({
  id: 'q1', client_name: 'Jane', status: 'invoiced', total: 2000, amount_paid: 0, paid_at: null,
  invoice_number: 'INV-1', invoiced_at: '2026-11-01T14:00:00Z', invoice_due_date: '2026-11-15',
  freelancers: pro, ...extra,
})

test('Barbados days, not UTC: 11pm in Barbados is still the same day', () => {
  assert.equal(barbadosToday(Date.parse('2026-11-16T02:30:00Z')), '2026-11-15') // 10:30pm AST on the 15th
  assert.equal(barbadosToday(Date.parse('2026-11-16T04:00:00Z')), '2026-11-16')
  assert.equal(daysFrom('2026-11-15', '2026-11-12'), -3)
  assert.equal(daysFrom('2026-11-15', '2026-12-15'), 30)
})

test('an invoice due today in Barbados does not fire a day early on UTC\'s calendar', () => {
  // 10pm AST on the 14th is already the 15th in UTC: still "due soon", not "due today".
  const d = decideReminder(inv(), { nowMs: Date.parse('2026-11-15T02:00:00Z') })
  assert.equal(d.stage, 'due_soon')
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-15') }).stage, 'due_today')
})

test('the five stages', () => {
  assert.equal(stageFor(-4), null)
  assert.equal(stageFor(-3).key, 'due_soon'); assert.equal(stageFor(-1).key, 'due_soon')
  assert.equal(stageFor(0).key, 'due_today'); assert.equal(stageFor(6).key, 'due_today')
  assert.equal(stageFor(7).key, 'overdue_7'); assert.equal(stageFor(13).key, 'overdue_7')
  assert.equal(stageFor(14).key, 'overdue_14'); assert.equal(stageFor(29).key, 'overdue_14')
  assert.equal(stageFor(30).key, 'final'); assert.equal(stageFor(59).key, 'final')
  assert.equal(stageFor(60), null); assert.equal(stageFor(400), null)
})

// ── decided from the job's own log (what the daily job passes in) ──
const log = (stage, sent_on, extra = {}) => ({ invoice_number: 'INV-1', stage, sent_on, error: null, ...extra })

test('with the log: a stage already in it is not sent again, whatever the row says', () => {
  const d = decideReminder(inv({ reminder_stage: null, last_reminder_sent: null }), { nowMs: at('2026-11-23'), history: [log('overdue_7', '2026-11-22')] })
  assert.deepEqual([d.send, d.reason], [false, 'this stage already sent'])
  // the next stage still goes
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-29'), history: [log('overdue_7', '2026-11-22')] }).stage, 'overdue_14')
})

test('with the log: an invoice number with a colon in it cannot repeat a stage', () => {
  const q = inv({ invoice_number: 'INV:1', reminder_stage: 'INV:1:final' })
  const history = [log('overdue_7', '2026-11-22', { invoice_number: 'INV:1' })]
  assert.equal(decideReminder(q, { nowMs: at('2026-11-23'), history }).send, false)
  // and the row's own stamp is read correctly when there is no log
  assert.equal(decideReminder(q, { nowMs: at('2026-12-20') }).reason, 'this stage already sent')
})

test('with the log: reminders never start on an invoice already 14 or more days overdue', () => {
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-28'), history: [] }).stage, 'overdue_7')   // 13 days: starts
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-29'), history: [] }).reason, 'too far overdue to start reminders')
  assert.equal(decideReminder(inv(), { nowMs: at('2026-12-20'), history: [] }).reason, 'too far overdue to start reminders')
  // one already under way carries on to the final reminder
  assert.equal(decideReminder(inv(), { nowMs: at('2026-12-20'), history: [log('due_soon', '2026-11-12')] }).stage, 'final')
})

test('nothing at all once an invoice is 60 or more days overdue', () => {
  assert.equal(decideReminder(inv(), { nowMs: at('2027-01-14'), history: [log('due_soon', '2026-11-12')] }).reason, 'more than 60 days overdue')
  assert.equal(decideReminder(inv({ invoice_due_date: '2025-01-15' }), { nowMs: at('2026-11-14') }).send, false)
})

test('with the log: a failed send is tried again, three times in all', () => {
  const failed = n => Array.from({ length: n }, (_, i) => log('overdue_7', `2026-11-2${2 + i}`, { error: 'provider down' }))
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-25'), history: failed(2) }).send, true)
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-26'), history: failed(3) }).reason, 'this stage already sent')
  // a claim that never finished ("pending") counts as not sent
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-25'), history: [log('overdue_7', '2026-11-24', { error: 'pending' })] }).send, true)
})

test('with the log: once a day, and ten reminders per job at most', () => {
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-22'), history: [log('due_today', '2026-11-22')] }).reason, 'already reminded today')
  const ten = Array.from({ length: 10 }, (_, i) => log('due_soon', `2026-10-${10 + i}`, { invoice_number: 'INV-OTHER-' + i }))
  assert.equal(decideReminder(inv(), { nowMs: at('2026-11-22'), history: ten }).reason, 'reminder limit reached for this job')
})

test('an unreadable due date sends nothing', () => {
  assert.equal(decideReminder(inv({ invoice_due_date: 'soon' }), { nowMs: at('2026-11-22'), history: [] }).send, false)
})

test('a full run through an invoice\'s life sends five reminders, then stops', () => {
  let q = inv()
  const sent = []
  for (let day = Date.parse('2026-11-10T12:00:00Z'); day <= Date.parse('2027-01-31T12:00:00Z'); day += 24 * 3600 * 1000) {
    const key = new Date(day).toISOString().slice(0, 10)
    const d = decideReminder(q, { nowMs: at(key) })
    if (d.send) {
      sent.push(`${key} ${d.stage}${d.notifyPro ? ' +pro' : ''}`)
      q = { ...q, last_reminder_sent: key, reminder_stage: `${d.invoice.number}:${d.stage}` }
    }
  }
  assert.deepEqual(sent, [
    '2026-11-12 due_soon', '2026-11-15 due_today', '2026-11-22 overdue_7 +pro', '2026-11-29 overdue_14 +pro', '2026-12-15 final +pro',
  ])
})

test('a missed day sends the current stage only, never a backlog', () => {
  const q = inv({ reminder_stage: 'INV-1:due_soon', last_reminder_sent: '2026-11-12' })
  const d = decideReminder(q, { nowMs: at('2026-12-01') }) // 16 days late: skipped due_today and overdue_7
  assert.equal(d.stage, 'overdue_14')
  assert.equal(decideReminder({ ...q, reminder_stage: 'INV-1:overdue_14' }, { nowMs: at('2026-12-02') }).send, false)
})

test('never twice in one day', () => {
  const d = decideReminder(inv({ last_reminder_sent: '2026-11-15' }), { nowMs: at('2026-11-15') })
  assert.deepEqual(d, { send: false, reason: 'already reminded today' })
})

test('nothing for paid, paused, switched off, or brand-new invoices', () => {
  const now = at('2026-11-22')
  assert.equal(decideReminder(inv({ paid_at: '2026-11-20T12:00:00Z', status: 'paid' }), { nowMs: now }).send, false)
  assert.equal(decideReminder(inv({ reminders_paused: true }), { nowMs: now }).reason, 'paused on this invoice')
  assert.equal(decideReminder(inv({ freelancers: { ...pro, payment_reminders_enabled: false } }), { nowMs: now }).reason, 'reminders off for this professional')
  assert.equal(decideReminder(inv({ status: 'accepted', invoice_number: null }), { nowMs: now }).send, false)
  // Due on receipt and sent this morning: overdue on paper, but under 24 hours old.
  const fresh = inv({ invoiced_at: new Date(now - 3 * 3600 * 1000).toISOString(), invoice_due_date: '2026-11-22' })
  assert.equal(decideReminder(fresh, { nowMs: now }).reason, 'sent less than 24 hours ago')
  assert.equal(decideReminder(fresh, { nowMs: now + 24 * 3600 * 1000 }).stage, 'due_today')
})

test('part-paid: the reminder is for what is still owed', () => {
  const d = decideReminder(inv({ amount_paid: 750 }), { nowMs: at('2026-11-22') })
  assert.equal(d.outstanding, 1250)
  const { html, subject } = reminderEmail(inv({ amount_paid: 750 }), d, { greeting: 'Hi Jane' })
  assert.match(subject, /Invoice INV-1 from Carson Pitts is 7 days overdue/)
  assert.match(html, /Still to pay/); assert.match(html, /Bds\$1250\.00/); assert.match(html, /Already paid/); assert.match(html, /Bds\$750\.00/)
  assert.doesNotMatch(html.replace(/Invoice total[\s\S]*?<\/tr>/, ''), /2000\.00/)
})

test('a deposit job: reminders follow the deposit, then pause until the balance is invoiced, then start again', () => {
  const dep = inv({ is_deposit: true, invoice_amount: 1000, deposit_type: 'percent', deposit_value: 50 })
  const d1 = decideReminder(dep, { nowMs: at('2026-11-22') })
  assert.equal(d1.invoice.kind, 'deposit'); assert.equal(d1.outstanding, 1000)
  const depPaid = { ...dep, amount_paid: 1000, reminder_stage: 'INV-1:overdue_7' }
  assert.equal(decideReminder(depPaid, { nowMs: at('2026-11-30') }).reason, 'nothing outstanding on the current invoice')
  const bal = { ...depPaid, balance_invoice_number: 'INV-2', balance_invoiced_at: '2026-12-01T14:00:00Z', balance_invoice_due_date: '2026-12-15' }
  const d2 = decideReminder(bal, { nowMs: at('2026-12-12') })
  assert.equal(d2.invoice.number, 'INV-2'); assert.equal(d2.stage, 'due_soon'); assert.equal(d2.outstanding, 1000)
  assert.match(reminderEmail(bal, d2).subject, /balance invoice INV-2/)
})

test('the email: amount, number, due date, payment details, escaped, and no claim that Vetted takes payment', () => {
  const q = inv({ freelancers: { ...pro, payment_details: '<script>x</script> Acct 1234' } })
  const d = decideReminder(q, { nowMs: at('2026-11-12') })
  const { subject, html } = reminderEmail(q, d)
  assert.equal(subject, 'Reminder: invoice INV-1 from Carson Pitts is due on 15 Nov 2026')
  assert.match(html, /INV-1/); assert.match(html, /15 Nov 2026/); assert.match(html, /Bds\$2000\.00/)
  assert.match(html, /How to pay Carson Pitts/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/)
  assert.match(html, /Vetted\.bb does not take payments/)
  const none = reminderEmail(inv({ freelancers: { ...pro, payment_details: '' } }), d).html
  assert.doesNotMatch(none, /How to pay/)
  const final = decideReminder(inv({ reminder_stage: 'INV-1:overdue_14' }), { nowMs: at('2026-12-15') })
  assert.match(reminderEmail(inv(), final).subject, /^Final reminder: invoice INV-1 .* 30 days overdue$/)
})

test('the professional\'s notice', () => {
  const d = decideReminder(inv(), { nowMs: at('2026-11-22') })
  assert.deepEqual(proNotice(inv(), d), {
    type: 'reminder', title: 'Invoice INV-1 to Jane is 7 days overdue', body: 'Bds$2000.00 outstanding. A reminder was emailed to them.', link: '/quotes',
  })
})
