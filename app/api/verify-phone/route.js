import { createClient } from '@supabase/supabase-js'

// Finalises phone verification. The OTP send/check is done by Supabase
// Auth on the client (updateUser + verifyOtp); this route confirms the
// phone is actually confirmed on the auth user, then flips the
// service-role-only phone_verified flag on the freelancer row. The flag
// is protected by a trigger, so a freelancer cannot set it themselves.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for verification.' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return Response.json({ error: 'You must be logged in.' }, { status: 401 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) {
      return Response.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 })
    }

    // Trust comes from Supabase Auth here: phone_confirmed_at is only set
    // once the OTP has been verified.
    if (!user.phone_confirmed_at || !user.phone) {
      return Response.json({ error: 'Your phone number has not been confirmed yet.' }, { status: 400 })
    }

    const { error: upErr } = await admin
      .from('freelancers')
      .update({ phone_verified: true, phone: user.phone })
      .eq('user_id', user.id)

    if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
