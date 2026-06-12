import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { sendPushToUser } from '@/lib/serverPush'

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
// sends a quote. The recipient (and the freelancer's display name) are
// looked up server-side from message_id — the request body can't choose
// who gets emailed, so this can't be used as a relay.
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

    if (!messageId) {
      return Response.json({ error: 'message_id required' }, { status: 400 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: msg } = await admin
      .from('messages')
      .select('id, subject, sender_name, sender_email, sender_user_id, freelancer_id, freelancers(name, company_name)')
      .eq('id', messageId)
      .maybeSingle()

    if (!msg?.sender_email) {
      return Response.json({ error: 'Thread not found' }, { status: 404 })
    }

    const freelancerName = msg.freelancers?.company_name?.trim().length > 3
      ? msg.freelancers.company_name
      : msg.freelancers?.name || 'Your freelancer'

    // Push to the client's devices (only possible when they signed up)
    sendPushToUser(msg.sender_user_id, {
      title: isInvoice
        ? `${freelancerName} sent you an invoice`
        : isQuote
        ? `${freelancerName} sent you a quote`
        : `${freelancerName} replied`,
      body: isInvoice
        ? (replyBody.slice(0, 120) || 'Open your messages to view it.')
        : isQuote
        ? 'Open your messages to review and respond.'
        : replyBody.slice(0, 120),
      url: '/messages',
    }).catch(() => {})

    const safeFreelancer = escapeHtml(freelancerName)
    const safeClientName = escapeHtml(msg.sender_name || '')
    const safeSubject = escapeHtml(msg.subject || 'your conversation')
    const safeBody = escapeHtml(replyBody)

    await sendEmail({
      to: msg.sender_email,
      subject: isInvoice
        ? `${freelancerName} sent you an invoice — ${msg.subject || 'Vetted.bb'}`
        : isQuote
        ? `${freelancerName} sent you a quote — ${msg.subject || 'Vetted.bb'}`
        : `${freelancerName} replied — ${msg.subject || 'Vetted.bb'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
          <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: #00267F; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
              <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">${isInvoice ? 'You have a new invoice' : isQuote ? 'You have a new quote' : 'You have a reply'}</p>
            </div>
            <div style="padding: 28px 24px;">
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hi ${safeClientName},</p>
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
                <strong>${safeFreelancer}</strong> ${isInvoice ? 'has sent you an invoice' : isQuote ? 'has sent you a quote' : 'has replied to your conversation'} on Vetted.bb.
              </p>
              <div style="background: #f9fafb; border-left: 3px solid #00267F; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Conversation</p>
                <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 12px;">${safeSubject}</p>
                ${safeBody && !isQuote && !isInvoice ? `
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Reply</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${safeBody}</p>` : ''}
              </div>
              <a href="https://vetted.bb/messages" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
                ${isInvoice ? 'View your invoice →' : isQuote ? 'View your quote →' : 'View the conversation →'}
              </a>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Vetted.bb · Connecting Barbados · <a href="https://vetted.bb" style="color: #00267F;">vetted.bb</a>
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
