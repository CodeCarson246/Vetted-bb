import { createClient } from '@supabase/supabase-js'
import { decideReminder, reminderEmail, proNotice, barbadosToday, STAGES } from '@/lib/paymentReminders'
import { threadRecipients } from '@/lib/serverOrgRecipients'
import { sendEmail } from '@/lib/serverEmail'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

export const maxDuration = 60

// Daily Vercel cron (see vercel.json): emails clients about unpaid and
// part-paid invoices, and tells the professional at 7, 14 and 30 days
// overdue. Which invoice gets what is decided in lib/paymentReminders.js;
// this only gathers the invoices, sends, and records.
//
// Protected like /api/cron/purge-deactivated: Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`.
//
// DRY RUN BY DEFAULT. Nothing is emailed, notified or stamped unless the
// environment variable PAYMENT_REMINDERS_MODE is exactly "live". In dry-run
// mode every reminder that WOULD go out is written to payment_reminder_log
// with dry_run = true and listed in the response, so the first runs can be
// checked before any client hears anything.
//
// WHO IS EMAILED. Only the people in the conversation the quote belongs to
// (the client who enquired, or the members of the organisation). A quote
// with no conversation is never reminded, and the email address written on
// the quote is never used: a professional can write anything on their own
// quote rows, and this job must not email whoever they name.
//
// WHAT HAS BEEN SENT is read from payment_reminder_log, which only this job
// writes, not from the stamps on the quote's row. A row is claimed before
// the email goes (a unique index allows one per invoice per Barbados day),
// marked sent when the email provider accepts it, and marked with the error
// when it does not, so a failed send is tried again another day.
const PAGE = 500
// Stop starting new reminders with time to spare; the rest go tomorrow
// (a stage is a range of days, so nothing is lost).
const BUDGET_MS = 45_000
const PENDING = 'pending'

const dayPlus = (key, n) => new Date(Date.parse(`${key}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'Not configured.' }, { status: 500 })
  if ((request.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

  const live = process.env.PAYMENT_REMINDERS_MODE === 'live'
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
  const started = Date.now()
  const nowMs = started
  const today = barbadosToday(nowMs)

  // Only invoices that can be in a stage today: due from 3 days ahead back
  // to the last day of the final stage. Older ones are finished and are not
  // read at all, so they can never crowd newer invoices out of the run. A
  // deposit job is found by either of its two invoices' due dates.
  const earliest = dayPlus(today, -STAGES[STAGES.length - 1].to)
  const latest = dayPlus(today, -STAGES[0].from)
  const inWindow = col => `and(${col}.gte.${earliest},${col}.lte.${latest})`

  const result = { mode: live ? 'live' : 'dry-run', day: today, checked: 0, reminders: [], skipped: {} }
  const skip = reason => { result.skipped[reason] = (result.skipped[reason] || 0) + 1 }

  pages:
  for (let from = 0; ; from += PAGE) {
    const { data: open, error } = await admin
      .from('quotes')
      .select('*, freelancers(id, user_id, name, company_name, email, payment_details, payment_reminders_enabled)')
      .not('invoice_number', 'is', null)
      .not('message_id', 'is', null)
      .is('paid_at', null)
      .in('status', ['invoiced', 'completed'])
      .or(`${inWindow('invoice_due_date')},${inWindow('balance_invoice_due_date')}`)
      .order('invoice_due_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[payment-reminders] could not read invoices:', error.message)
      return Response.json({ ...result, error: error.message }, { status: 500 })
    }
    const rows = open || []
    result.checked += rows.length
    if (rows.length === 0) break

    // What this job has already sent for these jobs, and the conversations
    // they belong to: two reads for the whole page.
    const ids = rows.map(q => q.id)
    const msgIds = [...new Set(rows.map(q => q.message_id).filter(Boolean))]
    const [{ data: logRows, error: logErr }, { data: msgs }] = await Promise.all([
      admin.from('payment_reminder_log').select('quote_id, invoice_number, stage, sent_on, error').in('quote_id', ids).eq('dry_run', false),
      admin.from('messages').select('id, freelancer_id, sender_name, sender_email, sender_user_id, organisation_id').in('id', msgIds),
    ])
    if (logErr) {
      // Without the log there is no knowing what was sent: send nothing.
      console.error('[payment-reminders] could not read the log:', logErr.message)
      return Response.json({ ...result, error: logErr.message }, { status: 500 })
    }
    const historyOf = {}
    for (const l of logRows || []) (historyOf[l.quote_id] = historyOf[l.quote_id] || []).push(l)
    const threadOf = Object.fromEntries((msgs || []).map(m => [m.id, m]))

    for (const q of rows) {
      if (Date.now() - started > BUDGET_MS) { result.stoppedEarly = true; break pages }

      const decision = decideReminder(q, { nowMs, history: historyOf[q.id] || [] })
      if (!decision.send) { skip(decision.reason); continue }

      // The conversation must be one of this professional's own.
      const msg = threadOf[q.message_id]
      if (!msg || msg.freelancer_id !== q.freelancer_id) { skip('no conversation'); continue }
      const recipients = await threadRecipients(admin, msg)
      if (recipients.emails.length === 0) { skip('no client email'); continue }

      const entry = {
        quote: q.quote_number, invoice: decision.invoice.number, stage: decision.stage,
        amount: decision.outstanding, to: recipients.emails, pro: decision.notifyPro,
      }
      const logRow = {
        quote_id: q.id, invoice_number: decision.invoice.number, stage: decision.stage, sent_on: today,
        amount: decision.outstanding, recipients: recipients.emails, dry_run: !live,
      }

      if (!live) {
        await admin.from('payment_reminder_log').insert(logRow)
        console.log('[payment-reminders] DRY RUN would send', JSON.stringify(entry))
        result.reminders.push({ ...entry, sent: false })
        continue
      }

      // Claim today's reminder for this invoice first. The unique index turns
      // a second attempt on the same day into an error here, so nothing is
      // sent. The claim counts as NOT sent until the email is accepted: if
      // this run is cut off in between, it is tried again another day.
      const { data: claimed, error: claimErr } = await admin.from('payment_reminder_log')
        .insert({ ...logRow, error: PENDING }).select('id').single()
      if (claimErr || !claimed) { skip('already sent today (log)'); continue }

      let sendError = null
      try {
        const { subject, html } = reminderEmail(q, decision, { siteUrl: SITE_URL, siteHost: SITE_HOST, greeting: recipients.greeting })
        const res = await sendEmail({ to: recipients.emails, subject, html })
        if (!res) sendError = 'email not configured'
        else if (res.error || res.statusCode >= 400) sendError = String(res.message || res.error?.message || res.error || 'email failed')
      } catch (err) {
        sendError = err.message || 'email failed'
      }
      await admin.from('payment_reminder_log').update({ error: sendError ? sendError.slice(0, 300) : null }).eq('id', claimed.id)

      if (sendError) {
        // Not sent: the stage is not used up, and nobody is told it went.
        console.error('[payment-reminders] failed', JSON.stringify({ ...entry, error: sendError }))
        result.reminders.push({ ...entry, sent: false, error: sendError })
        continue
      }

      // For the professional's own screen only ("Last reminder emailed…").
      await admin.from('quotes').update({
        last_reminder_sent: today,
        reminder_stage: `${decision.invoice.number}:${decision.stage}`,
      }).eq('id', q.id)

      if (decision.notifyPro && q.freelancers?.user_id) {
        const notice = proNotice(q, decision)
        const outcome = await createNotification(q.freelancers.user_id, {
          ...notice, dedupeKey: `payment-reminder:${q.id}:${decision.invoice.number}:${decision.stage}`,
        })
        if (outcome !== 'duplicate') {
          await sendPushToUser(q.freelancers.user_id, { title: notice.title, body: notice.body, url: notice.link }).catch(() => {})
        }
      }

      console.log('[payment-reminders] sent', JSON.stringify(entry))
      result.reminders.push({ ...entry, sent: true })
    }

    if (rows.length < PAGE) break
  }

  if (result.stoppedEarly) console.warn('[payment-reminders] out of time; the rest go on the next run')
  return Response.json(result)
}
