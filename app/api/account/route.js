import { createClient } from '@supabase/supabase-js'

// Deactivate / reactivate the caller's own account.
//
// Deactivate: records the account in account_deactivations (purged for good by
// the daily cron 60 days later) and, for freelancers, stamps deactivated_at on
// their profile so every public surface drops it immediately. The user can
// still log in during the window — they just see the reactivation banner.
//
// Reactivate: removes the deactivation row and clears the profile stamp,
// restoring everything exactly as it was (including a previously hidden
// profile staying hidden — `hidden` is untouched by deactivation).
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await request.json()

    if (action === 'deactivate') {
      const now = new Date()
      const purgeAfter = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
      const { error } = await admin.from('account_deactivations').upsert({
        user_id: user.id,
        deactivated_at: now.toISOString(),
        purge_after: purgeAfter.toISOString(),
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      await admin.from('freelancers').update({ deactivated_at: now.toISOString() }).eq('user_id', user.id)
      return Response.json({ success: true, purge_after: purgeAfter.toISOString() })
    }

    if (action === 'reactivate') {
      const { error } = await admin.from('account_deactivations').delete().eq('user_id', user.id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      await admin.from('freelancers').update({ deactivated_at: null }).eq('user_id', user.id)
      return Response.json({ success: true })
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
