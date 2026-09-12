import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { threadRecipients, fanOut } from '@/lib/serverOrgRecipients'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

const RESEND_API_KEY = process.env.RESEND_API_KEY

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vetted.bb <notifications@vetted.bb>',
      to,
      subject,
      html,
    }),
  })
  return res.json()
}

// Notifies the CLIENT side of a thread when the freelancer replies or
// sends a quote, invoice, reminder or receipt. The recipients (and the
// freelancer's display name) are looked up server-side from message_id, so
// the request body can't choose who gets emailed and this can't be used as
// a relay.
//
// An individual client is one person. A thread sent by an ORGANISATION fans
// out to every member of it (see lib/serverOrgRecipients), so a quote is
// never sitting unseen because the colleague who enquired is away.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for notifications.' }, { status: 500 })
    }

    if (!rateLimit(`notify-reply:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many notifications. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const messageId = body.message_id
    const replyBody = String(body.message || '').slice(0, 5000)
    const isQuote = body.kind === 'quote'
    const isInvoice = body.kind === 'invoice'
    const isReminder = body.kind === 'reminder'
    const isReceipt = body.kind === 'receipt'

    if (!messageId) {
      return Response.json({ error: 'message_id required' }, { status: 400 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: msg } = await admin
      .from('messages')
      .select('id, subject, sender_name, sender_email, sender_user_id, organisation_id, freelancer_id, freelancers(name, company_name)')
      .eq('id', messageId)
      .maybeSingle()

    if (!msg) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    const freelancerName = msg.freelancers?.company_name?.trim().length > 3
      ? msg.freelancers.company_name
      : msg.freelancers?.name || 'Your freelancer'

    const recipients = await threadRecipients(admin, msg)
    // "you" reads oddly to a whole team; address the organisation instead.
    const you = recipients.isOrganisation && recipients.organisationName ? recipients.organisationName : 'you'

    const title = isReceipt
      ? `${freelancerName} sent ${you} a receipt`
      : isInvoice
      ? `${freelancerName} sent ${you} an invoice`
      : isReminder
      ? `Payment reminder from ${freelancerName}`
      : isQuote
      ? `${freelancerName} sent ${you} a quote`
      : `${freelancerName} replied`

    // In-app + push for every recipient (awaited so inserts finish before
    // the function returns).
    await fanOut(recipients.userIds, {
      type: isReceipt ? 'receipt' : isInvoice ? 'invoice' : isReminder ? 'reminder' : isQuote ? 'quote' : 'reply',
      title,
      body: (isInvoice || isReminder || isReceipt) ? replyBody.slice(0, 140) : isQuote ? 'Review and respond in your messages.' : replyBody.slice(0, 140),
      link: '/messages',
    })

    if (recipients.emails.length === 0) {
      return Response.json({ success: true })
    }

    const safeFreelancer = escapeHtml(freelancerName)
    const safeGreeting = escapeHtml(recipients.greeting)
    const safeSubject = escapeHtml(msg.subject || 'your conversation')
    const safeBody = escapeHtml(replyBody)
    const orgNote = recipients.isOrganisation
      ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 20px;">Everyone on your organisation's team receives this, so any of you can respond.</p>`
      : ''

    await sendEmail({
      to: recipients.emails,
      subject: isReceipt
        ? `${freelancerName} sent ${you} a receipt: ${msg.subject || 'Vetted.bb'}`
        : isInvoice
        ? `${freelancerName} sent ${you} an invoice: ${msg.subject || 'Vetted.bb'}`
        : isReminder
        ? `Payment reminder from ${freelancerName}: ${msg.subject || 'Vetted.bb'}`
        : isQuote
        ? `${freelancerName} sent ${you} a quote: ${msg.subject || 'Vetted.bb'}`
        : `${freelancerName} replied: ${msg.subject || 'Vetted.bb'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
          <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: #00267F; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
              <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">${isReceipt ? 'Payment receipt' : isInvoice ? 'You have a new invoice' : isReminder ? 'Payment reminder' : isQuote ? 'You have a new quote' : 'You have a reply'}</p>
            </div>
            <div style="padding: 28px 24px;">
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">${safeGreeting},</p>
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
                <strong>${safeFreelancer}</strong> ${isReceipt ? 'has sent a paid receipt for your records' : isInvoice ? 'has sent an invoice' : isReminder ? 'has sent a payment reminder' : isQuote ? 'has sent a quote' : 'has replied to your conversation'} on Vetted.bb.
              </p>
              ${orgNote}
              <div style="background: #f9fafb; border-left: 3px solid #00267F; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Conversation</p>
                <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 12px;">${safeSubject}</p>
                ${safeBody && !isQuote && !isInvoice ? `
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">${isReceipt ? 'Receipt' : isReminder ? 'Reminder' : 'Reply'}</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${safeBody}</p>` : ''}
              </div>
              <a href="${SITE_URL}/messages" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
                ${isReceipt ? 'View the receipt →' : isInvoice ? 'View the invoice →' : isReminder ? 'View & pay →' : isQuote ? 'View the quote →' : 'View the conversation →'}
              </a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Vetted.bb · Connecting Barbados · <a href="${SITE_URL}" style="color: #00267F;">${SITE_HOST}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
