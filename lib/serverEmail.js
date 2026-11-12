// Server-only: one place that talks to Resend. Skips quietly when the key is
// not set (local development), so a missing email never fails the request
// that triggered it.
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (!key || recipients.length === 0) return null
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vetted.bb <notifications@vetted.bb>',
      to: recipients,
      subject,
      html,
    }),
  })
  return res.json()
}
