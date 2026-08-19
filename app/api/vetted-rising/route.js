import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { PARISHES } from '@/lib/parishes'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

const RESEND_API_KEY = process.env.RESEND_API_KEY

// Where the "new application" alert goes. Reuses the same server-only list
// the admin panel uses (ADMIN_EMAILS), so there is one place to manage it.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function sendAdminEmail(app) {
  if (!RESEND_API_KEY) return
  const to = adminEmails()
  if (to.length === 0) return

  const row = (label, value) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; width: 190px; vertical-align: top;">${escapeHtml(label)}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600; white-space: pre-wrap;">${escapeHtml(value)}</td>
    </tr>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vetted.bb <notifications@vetted.bb>',
      to,
      subject: `New Vetted Rising application - ${app.full_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
          <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: #00267F; padding: 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted Rising</h1>
              <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">New application received</p>
            </div>
            <div style="padding: 28px 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                ${row('Full name', app.full_name)}
                ${row('Age', String(app.age))}
                ${row('Parish', app.parish)}
                ${row('What they do', app.skill)}
                ${row('WhatsApp', app.whatsapp)}
                ${row('Anything else', app.notes || 'Not provided')}
              </table>
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Vetted.bb · Connecting Barbados · <a href="${SITE_URL}" style="color: #00267F;">${SITE_HOST}</a>
              </p>
            </div>
          </div>
        </div>
      `,
    }),
  })
}

export async function POST(request) {
  try {
    if (!rateLimit(`vetted-rising:${clientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many applications from this connection. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const full_name = String(body.full_name || '').trim().slice(0, 120)
    const age = parseInt(body.age, 10)
    const parish = String(body.parish || '').trim()
    const skill = String(body.skill || '').trim().slice(0, 160)
    const whatsapp = String(body.whatsapp || '').trim().slice(0, 40)
    const notes = String(body.notes || '').trim().slice(0, 300)

    if (!full_name || !parish || !skill || !whatsapp) {
      return Response.json({ error: 'Please fill in all the required fields.' }, { status: 400 })
    }
    if (!Number.isInteger(age) || age < 16 || age > 30) {
      return Response.json({ error: 'Age must be between 16 and 30 to apply.' }, { status: 400 })
    }
    if (!PARISHES.includes(parish)) {
      return Response.json({ error: 'Please choose a parish from the list.' }, { status: 400 })
    }
    // Loose on purpose: local numbers get written many ways. Just make sure
    // there are enough digits to actually be a phone number.
    if ((whatsapp.match(/\d/g) || []).length < 7) {
      return Response.json({ error: 'Please enter a WhatsApp number we can reach you on.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
    const application = { full_name, age, parish, skill, whatsapp, notes: notes || null }
    const { error } = await supabase.from('vetted_rising_applications').insert(application)

    if (error) {
      return Response.json({ error: 'We could not save your application. Please try again.' }, { status: 500 })
    }

    // The application is already saved. The alert email is best-effort and
    // must never turn a saved application into an error for the applicant.
    try {
      await sendAdminEmail(application)
    } catch {
      /* ignore: the row is in the database, which is what matters */
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
