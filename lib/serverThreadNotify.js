import { escapeHtml } from '@/lib/escapeHtml'
import { threadRecipients, fanOut } from '@/lib/serverOrgRecipients'
import { sendEmail } from '@/lib/serverEmail'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

// Server-only. Tells the CLIENT side of a thread that the professional has
// replied or sent a quote, invoice, reminder or receipt: an in-app
// notification, a push, and an email.
//
// The recipients (and the professional's display name) are looked up from
// the thread itself, so a caller can never choose who gets emailed.
//
// An individual client is one person. A thread sent by an ORGANISATION fans
// out to every member of it (see lib/serverOrgRecipients), so a quote is
// never sitting unseen because the colleague who enquired is away.
//
// Used by /api/notify-reply (the professional's own actions) and by the
// invoice that goes out by itself when a quote is accepted.
export async function notifyThreadClient(admin, { messageId, kind = 'reply', message = '' }) {
  const replyBody = String(message || '').slice(0, 5000)
  const isQuote = kind === 'quote'
  const isInvoice = kind === 'invoice'
  const isReminder = kind === 'reminder'
  const isReceipt = kind === 'receipt'

  const { data: msg } = await admin
    .from('messages')
    .select('id, subject, sender_name, sender_email, sender_user_id, organisation_id, freelancer_id, freelancers(name, company_name)')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg) return { ok: false, status: 404, error: 'Thread not found' }

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

  if (recipients.emails.length === 0) return { ok: true }

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

  return { ok: true }
}
