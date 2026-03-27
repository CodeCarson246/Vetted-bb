import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { freelancerEmail, freelancerName, senderName, senderEmail, subject, message } = await request.json()

    if (!freelancerEmail || !senderName || !subject) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await resend.emails.send({
      from: 'Vetted.bb <notifications@vetted.bb>',
      to: freelancerEmail,
      subject: `New message from ${senderName} — ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
          <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: #00267F; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
              <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">You have a new message</p>
            </div>
            <div style="padding: 28px 24px;">
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hi ${freelancerName},</p>
              <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
                <strong>${senderName}</strong> (${senderEmail}) has sent you a message through Vetted.bb.
              </p>
              <div style="background: #f9fafb; border-left: 3px solid #00267F; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Subject</p>
                <p style="color: #111827; font-size: 14px; font-weight: 600; margin: 0 0 12px;">${subject}</p>
                <p style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Message</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
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
