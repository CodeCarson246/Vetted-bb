import { createClient } from '@supabase/supabase-js'
import { validatePassword } from '@/lib/passwordPolicy'
import { rateLimit, clientIp } from '@/lib/rateLimit'

// All signups go through here so the password policy is enforced
// server-side, not just in the form. The route validates against the same
// shared policy, then performs the Supabase signup (which still sends the
// confirmation email / returns a session as usual).
export async function POST(request) {
  try {
    if (!rateLimit(`signup:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many attempts. Please try again in a few minutes.' }, { status: 429 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    const fullName = String(body.fullName || '').trim()
    const role = body.role === 'freelancer' ? 'freelancer' : 'client'

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const { valid } = validatePassword(password, { name: fullName, email })
    if (!valid) {
      return Response.json({
        error: 'Password must be at least 8 characters, include an uppercase letter and a mix of letters and numbers, and must not contain your name or email.',
      }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    // session present → auto-confirm projects (client sets it and redirects);
    // null → email confirmation required (client shows the "check email" state).
    return Response.json({
      session: data.session
        ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token }
        : null,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
