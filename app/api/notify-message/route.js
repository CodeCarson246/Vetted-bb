import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { sendPushToUser } from '@/lib/serverPush'
import { createNotification } from '@/lib/serverNotify'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'
import { isOrganisationMember } from '@/lib/serverOrgRecipients'
import { signedInUser, isUuid, isFresh, claimNotification } from '@/lib/serverNotifyGuard'
import { enquiryNoticeFromMessage, enquiryNoticeFromReply } from '@/lib/notifyContent'

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

// Tells a professional that a client has written to them: an email, a push
// and an in-app notification.
//
// The request carries the id of a saved row and nothing else:
//   { messageId }  a new conversation (a row in messages)
//   { replyId }    a client's reply in one (a row in message_replies)
//
// Who it is from, who it goes to and what it says are all read from that
// row, so the request cannot invent a sender, pick a recipient or supply the
// text. The caller must be signed in and must be the person who wrote the
// row. A row is announced once, and only while it is new (see
// lib/serverNotifyGuard). All interpolated fields are HTML-escaped.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for notifications.' }, { status: 500 })
    }

    if (!rateLimit(`notify:${clientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const user = await signedInUser(admin, request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const messageId = body?.messageId
    const replyId = body?.replyId
    // Exactly one of the two, and it must look like an id.
    if ((messageId == null) === (replyId == null) || !isUuid(messageId ?? replyId)) {
      return Response.json({ error: 'A messageId or a replyId is required.' }, { status: 400 })
    }

    // select('*') so this keeps working before SQL Section 39 adds
    // notified_at: the column simply reads as undefined.
    let table, row, thread, notice
    if (messageId) {
      const { data } = await admin.from('messages').select('*').eq('id', messageId).maybeSingle()
      if (!data) return Response.json({ error: 'Message not found' }, { status: 404 })
      if (data.sender_user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })
      table = 'messages'; row = data; thread = data
      notice = enquiryNoticeFromMessage(data)
    } else {
      const { data: reply } = await admin.from('message_replies').select('*').eq('id', replyId).maybeSingle()
      if (!reply) return Response.json({ error: 'Reply not found' }, { status: 404 })
      if (reply.sender_user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const { data: parent } = await admin.from('messages').select('*').eq('id', reply.message_id).maybeSingle()
      if (!parent) return Response.json({ error: 'Conversation not found' }, { status: 404 })
      // Only the client side of a conversation notifies the professional
      // here: the person who started it, or a colleague in the organisation
      // it belongs to.
      const sameEmail = !!parent.sender_email && !!user.email && parent.sender_email.toLowerCase() === user.email.toLowerCase()
      const onClientSide = parent.sender_user_id === user.id || sameEmail
        || await isOrganisationMember(admin, parent.organisation_id, user.id)
      if (!onClientSide) return Response.json({ error: 'Forbidden' }, { status: 403 })
      table = 'message_replies'; row = reply; thread = parent
      notice = enquiryNoticeFromReply(reply, parent)
    }

    const { data: freelancer } = await admin
      .from('freelancers')
      .select('email, name, user_id')
      .eq('id', thread.freelancer_id)
      .maybeSingle()

    if (!freelancer?.email) {
      return Response.json({ error: 'Freelancer not found' }, { status: 404 })
    }

    // Old rows are never announced, and no row is announced twice. Both
    // answer 200: nothing is wrong, there is just nothing to send.
    if (!isFresh(row.created_at)) return Response.json({ success: true, sent: false })
    const claim = await claimNotification(admin, table, row.id)
    if (claim === 'already') return Response.json({ success: true, sent: false })
    if (claim === 'error') return Response.json({ error: 'Could not send the notification.' }, { status: 500 })

    // The email address shown to the professional is the one on the
    // sender's account, not one typed into a form.
    const senderEmail = String(user.email || '').slice(0, 200)
    let senderName = String(row.sender_name || '').trim().slice(0, 100) || senderEmail.split('@')[0] || 'A client'
    // An organisation's request for quotes names the organisation too.
    if (messageId && thread.organisation_id && thread.quote_request_id) {
      const { data: org } = await admin.from('organisations').select('name').eq('id', thread.organisation_id).maybeSingle()
      if (org?.name) senderName = `${senderName} (${org.name})`
    }
    const { subject, message } = notice

    // Browser push first (fire-and-forget) — the email below is the
    // reliable channel, push is the instant one.
    sendPushToUser(freelancer.user_id, {
      title: `${senderName} sent you a message`,
      body: message ? message.slice(0, 120) : subject,
      url: '/inbox',
    }).catch(() => {})

    // In-app notification — AWAIT so the insert finishes before this
    // serverless function returns (an un-awaited insert gets dropped when
    // the function freezes after the response).
    await createNotification(freelancer.user_id, {
      type: 'message',
      title: `${senderName} sent you a message`,
      body: message ? message.slice(0, 120) : subject,
      link: '/inbox',
    })

    const safeName = escapeHtml(senderName)
    const safeEmail = escapeHtml(senderEmail)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message)
    const safeFreelancerName = escapeHtml(freelancer.name || '')

    await sendEmail({
      to: freelancer.email,
      subject: `New message from ${senderName}: ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
          <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: #00267F; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
              <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">You have a new message</p>
            </div>
            <div style="padding: 28px 24px;">
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hi ${safeFreelancerName},</p>
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
                <strong>${safeName}</strong> (${safeEmail}) has sent you a message through Vetted.bb.
              </p>
              <div style="background: #f9fafb; border-left: 3px solid #00267F; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Subject</p>
                <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 12px;">${safeSubject}</p>
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Message</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${safeMessage}</p>
              </div>
              <a href="${SITE_URL}/inbox" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Reply in your inbox →
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
