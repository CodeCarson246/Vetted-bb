import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { isOrganisationMember, fanOut } from '@/lib/serverOrgRecipients'
import { issueInvoiceOnAcceptance } from '@/lib/serverInvoice'
import { sendEmail } from '@/lib/serverEmail'
import { escapeHtml } from '@/lib/escapeHtml'
import { fmtInvoiceDate, invoicePromptLink } from '@/lib/invoicing'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

// The email a professional gets when a client accepts their quote. A bell
// notification and a push are easy to miss; this is the one that waits in an
// inbox. It says plainly whose move it is: either the invoice has already
// gone, or it is theirs to send, with a button that goes straight there.
function acceptedEmail({ freelancerName, clientName, ref, total, invoice, quoteId }) {
  const safeName = escapeHtml(freelancerName)
  const safeClient = escapeHtml(clientName)
  const safeRef = escapeHtml(ref)
  const amount = `Bds$${Number(total || 0).toFixed(2)}`
  const next = invoice
    ? `Invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> was sent to them automatically, as you chose on the quote. Payment is due ${escapeHtml(fmtInvoiceDate(invoice.invoice_due_date))}. They are now expecting the work to go ahead.`
    : `They are waiting for your invoice. It takes two taps.`
  const cta = invoice
    ? { href: `${SITE_URL}/quotes`, label: 'Open Quotes & earnings →' }
    : { href: `${SITE_URL}${invoicePromptLink(quoteId)}`, label: 'Send the invoice →' }
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
      <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #00267F; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
          <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">Your quote was accepted</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hi ${safeName},</p>
          <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
            <strong>${safeClient}</strong> accepted your quote${safeRef ? ` <strong>${safeRef}</strong>` : ''} for <strong>${amount}</strong>.
          </p>
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${next}</p>
          <a href="${cta.href}" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${cta.label}
          </a>
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Vetted.bb · Connecting Barbados · <a href="${SITE_URL}" style="color: #00267F;">${SITE_HOST}</a>
          </p>
        </div>
      </div>
    </div>
  `
}

// Cross-party quote-lifecycle notifications. The caller (JWT) must be a
// participant in the quote; the recipient (the OTHER party) is resolved
// server-side, so the body can't choose who gets notified.
//   accepted | declined  → client acted   → notify freelancer
//   paid                 → freelancer acted → notify client
//   completed            → either acted    → notify the other side
//
// An acceptance does two more things. If the professional ticked "send the
// invoice automatically" on the quote, the invoice goes out here and the
// response says so, so the client's page can tell them it has arrived. And
// the professional is emailed, because a client who has accepted is waiting.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    if (!rateLimit(`quote-event:${clientIp(request)}`, { limit: 30, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { quote_id, event } = await request.json()
    const EVENTS = ['accepted', 'declined', 'completed', 'paid']
    if (!quote_id || !EVENTS.includes(event)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    // '*' so this keeps working on a database without the newer quote columns
    // (auto_invoice, accepted_at): they simply read as undefined.
    const { data: quote } = await admin
      .from('quotes')
      .select('*, freelancers(user_id, name, company_name, email)')
      .eq('id', quote_id)
      .maybeSingle()
    if (!quote) return Response.json({ error: 'Quote not found' }, { status: 404 })

    const freelancerUserId = quote.freelancers?.user_id
    const freelancerName = quote.freelancers?.company_name?.trim().length > 3
      ? quote.freelancers.company_name
      : quote.freelancers?.name || 'The professional'

    // Resolve the client's user id from the thread (sender), if any
    let clientUserId = null
    if (quote.message_id) {
      const { data: msg } = await admin.from('messages').select('sender_user_id').eq('id', quote.message_id).maybeSingle()
      clientUserId = msg?.sender_user_id || null
    }

    // An organisation's quote notifies every member of it, and any member
    // may act on it, not only the colleague who sent the enquiry.
    let clientUserIds = clientUserId ? [clientUserId] : []
    let isOrgMember = false
    if (quote.organisation_id) {
      const { data: members } = await admin.from('organisation_members').select('user_id').eq('organisation_id', quote.organisation_id)
      clientUserIds = [...new Set((members || []).map(m => m.user_id).filter(Boolean))]
      isOrgMember = await isOrganisationMember(admin, quote.organisation_id, user.id)
    }

    // Authorise: caller must be the freelancer owner or the addressed client
    const isFreelancer = user.id === freelancerUserId
    const isClient = (quote.client_email && user.email && quote.client_email === user.email) || user.id === clientUserId || isOrgMember
    if (!isFreelancer && !isClient) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ref = quote.invoice_number || quote.quote_number || ''
    const clientName = quote.client_name || 'The client'

    let recipients = []
    let payload = null
    let invoice = null

    // The request names an event; it does not get to decide that the event
    // happened. Each one is announced only by the side that performs it, and
    // only when the saved quote agrees. Anything else answers 200 and sends
    // nothing, so a participant cannot send the other side a false "declined",
    // "marked paid" or "marked complete".
    const nothingToSend = () => Response.json({ success: true, sent: false, invoice: null })
    if ((event === 'accepted' || event === 'declined') && !isClient) return nothingToSend()
    if (event === 'paid' && !isFreelancer) return nothingToSend()
    if (event === 'accepted' && quote.status !== 'accepted') return nothingToSend()
    if (event === 'declined' && quote.status !== 'declined') return nothingToSend()
    if (event === 'paid' && !quote.paid_at) return nothingToSend()
    if (event === 'completed' && !(isFreelancer ? quote.completed_at : quote.client_completed_at)) return nothingToSend()

    if (event === 'accepted') {
      recipients = freelancerUserId ? [freelancerUserId] : []
      const quoteRef = quote.quote_number || ''
      const reallyAccepted = true

      // Stamp when it was accepted, once. The stamp doubles as "is this the
      // first time we have heard about this acceptance?", which is what stops
      // a repeated request from emailing the professional again. If the
      // column is not there yet the update errors, and we carry on.
      let firstTime = reallyAccepted
      if (reallyAccepted) {
        const { data: stamped, error: stampErr } = await admin
          .from('quotes')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', quote.id)
          .is('accepted_at', null)
          .select('id')
        if (!stampErr) firstTime = (stamped || []).length > 0
      }

      if (reallyAccepted && quote.auto_invoice === true && !quote.invoice_number) {
        invoice = await issueInvoiceOnAcceptance(admin, quote, quote.freelancers)
      }

      // An acceptance is announced once. A repeat of the same request finds
      // the stamp already there and no invoice left to issue.
      if (!firstTime && !invoice) return nothingToSend()

      payload = invoice
        ? {
            type: 'quote_accepted',
            title: `${clientName} accepted your quote ${quoteRef}`.trim(),
            body: `Invoice ${invoice.invoice_number} was sent automatically, due ${fmtInvoiceDate(invoice.invoice_due_date)}.`,
            link: '/quotes',
          }
        : {
            type: 'quote_accepted',
            title: `${clientName} accepted your quote ${quoteRef}`.trim(),
            body: reallyAccepted ? 'They are waiting for your invoice.' : null,
            // Opens the short "send this invoice" confirmation for this quote.
            link: reallyAccepted ? invoicePromptLink(quote.id) : '/quotes',
          }

      if (reallyAccepted && firstTime && quote.freelancers?.email) {
        try {
          await sendEmail({
            to: quote.freelancers.email,
            subject: invoice
              ? `${clientName} accepted your quote ${quoteRef}: invoice sent`.replace(/\s+:/, ':')
              : `${clientName} accepted your quote ${quoteRef}: send your invoice`.replace(/\s+:/, ':'),
            html: acceptedEmail({
              freelancerName: quote.freelancers.name || freelancerName,
              clientName,
              ref: quoteRef,
              total: quote.total,
              invoice,
              quoteId: quote.id,
            }),
          })
        } catch (err) {
          console.error('accepted email failed:', err.message)
        }
      }
    } else if (event === 'declined') {
      recipients = freelancerUserId ? [freelancerUserId] : []
      payload = { type: 'quote_declined', title: `${clientName} declined your quote ${ref}`.trim(), link: '/quotes', dedupeKey: `quote:${quote.id}:declined` }
    } else if (event === 'paid') {
      recipients = clientUserIds
      // Keyed on the time it was marked paid: the same mark is announced
      // once, and a job un-marked and marked again is announced again.
      payload = { type: 'job_paid', title: `${freelancerName} marked your job as paid`, body: ref ? `Receipt for ${ref}` : null, link: '/jobs', dedupeKey: `quote:${quote.id}:paid:${quote.paid_at}` }
    } else if (event === 'completed') {
      if (isFreelancer) {
        recipients = clientUserIds
        payload = { type: 'job_completed', title: `${freelancerName} marked the job complete`, link: '/jobs', dedupeKey: `quote:${quote.id}:done:pro:${quote.completed_at}` }
      } else {
        recipients = freelancerUserId ? [freelancerUserId] : []
        payload = { type: 'job_completed', title: `${clientName} marked the job complete`, link: '/quotes', dedupeKey: `quote:${quote.id}:done:client:${quote.client_completed_at}` }
      }
    }

    if (recipients.length > 0 && payload) {
      await fanOut(recipients, payload)
    }

    return Response.json({ success: true, invoice })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
