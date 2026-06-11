import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Browser push to every device the freelancer enabled notifications on.
 * Requires the service-role key (subscriptions are RLS-protected) and
 * VAPID keys; silently skips if either is missing. Expired/revoked
 * subscriptions (404/410) are pruned as we go.
 */
async function sendPush(freelancerUserId, payload) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!serviceKey || !vapidPublic || !vapidPrivate || !freelancerUserId) return

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@vetted.bb',
    vapidPublic,
    vapidPrivate,
  )

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', freelancerUserId)

  await Promise.all((subs || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload))
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }))
}

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

// The recipient is looked up server-side from freelancer_id — the
// client never supplies a destination address, so this route can't be
// used as an open relay. All interpolated fields are HTML-escaped.
export async function POST(request) {
  try {
    if (!rateLimit(`notify:${clientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many messages. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const freelancerId = body.freelancer_id
    const senderName = String(body.senderName || '').slice(0, 100)
    const senderEmail = String(body.senderEmail || '').slice(0, 200)
    const subject = String(body.subject || '').slice(0, 200)
    const message = String(body.message || '').slice(0, 5000)

    if (!freelancerId || !senderName || !subject) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (senderEmail && !EMAIL_RE.test(senderEmail)) {
      return Response.json({ error: 'Invalid sender email' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('email, name, user_id')
      .eq('id', freelancerId)
      .maybeSingle()

    if (!freelancer?.email) {
      return Response.json({ error: 'Freelancer not found' }, { status: 404 })
    }

    // Browser push first (fire-and-forget) — the email below is the
    // reliable channel, push is the instant one.
    sendPush(freelancer.user_id, {
      title: `New message from ${senderName}`,
      body: subject,
      url: '/inbox',
    }).catch(() => {})

    const safeName = escapeHtml(senderName)
    const safeEmail = escapeHtml(senderEmail)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message)
    const safeFreelancerName = escapeHtml(freelancer.name || '')

    await sendEmail({
      to: freelancer.email,
      subject: `New message from ${senderName} — ${subject}`,
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
              <a href="https://vetted.bb/inbox" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Reply in your inbox →
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
