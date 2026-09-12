import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { escapeHtml } from '@/lib/escapeHtml'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { SITE_URL, SITE_HOST } from '@/lib/siteUrl'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Invite a colleague to an organisation. Runs AS the caller (their JWT is
// forwarded to Supabase), so row level security decides whether they may
// invite: only owners can insert into organisation_invites. The email is
// best-effort; the invite row is what matters, and the Team page also shows
// a copyable link for it.
export async function POST(request) {
  try {
    if (!rateLimit(`org-invite:${clientIp(request)}`, { limit: 20, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many invitations sent. Please try again later.' }, { status: 429 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return Response.json({ error: 'Not authenticated.' }, { status: 401 })

    const body = await request.json()
    const organisationId = String(body.organisation_id || '')
    const email = String(body.email || '').trim().toLowerCase()
    const role = body.role === 'owner' ? 'owner' : 'member'
    if (!organisationId || !EMAIL_RE.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return Response.json({ error: 'Not authenticated.' }, { status: 401 })

    // Owner check (RLS would refuse the insert anyway; this gives a clear message).
    const { data: me } = await supabase
      .from('organisation_members')
      .select('role, organisations(name)')
      .eq('organisation_id', organisationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!me || me.role !== 'owner') {
      return Response.json({ error: 'Only an owner can invite people.' }, { status: 403 })
    }
    const orgName = me.organisations?.name || 'the organisation'

    // Already on the team?
    const { data: existing } = await supabase
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', organisationId)
      .ilike('email', email)
      .maybeSingle()
    if (existing) return Response.json({ error: 'That person is already a member.' }, { status: 400 })

    const inviteToken = randomBytes(24).toString('hex')
    const { error: insertError } = await supabase
      .from('organisation_invites')
      .insert({ organisation_id: organisationId, email, role, token: inviteToken, invited_by: user.id })
    if (insertError) {
      return Response.json({ error: 'Could not create the invitation. Please try again.' }, { status: 500 })
    }

    const link = `${SITE_URL}/organisation/accept?token=${inviteToken}`
    const inviterName = user.user_metadata?.full_name || user.email

    // Best-effort email. The invite exists regardless, and the Team page
    // shows the link so it can be shared by hand if mail is not configured.
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Vetted.bb <notifications@vetted.bb>',
            to: email,
            subject: `${inviterName} invited you to join ${orgName} on Vetted.bb`,
            html: `
              <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb;">
                <div style="background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
                  <div style="background: #00267F; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Vetted.bb</h1>
                    <p style="color: #93b8ff; margin: 6px 0 0; font-size: 14px;">You have been invited to an organisation</p>
                  </div>
                  <div style="padding: 28px 24px;">
                    <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
                      <strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(orgName)}</strong> on Vetted.bb, so you can search for professionals, send enquiries and see the organisation's quotes and jobs in one place.
                    </p>
                    <a href="${link}" style="display: block; background: #00267F; color: white; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Accept the invitation
                    </a>
                    <p style="color: #9ca3af; font-size: 12px; margin: 18px 0 0;">Use this email address when you sign up or log in. The link is valid for 14 days.</p>
                  </div>
                  <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Vetted.bb · Connecting Barbados · <a href="${SITE_URL}" style="color: #00267F;">${SITE_HOST}</a></p>
                  </div>
                </div>
              </div>`,
          }),
        })
      } catch { /* ignore: the invite row is what matters */ }
    }

    return Response.json({ success: true, link })
  } catch {
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
