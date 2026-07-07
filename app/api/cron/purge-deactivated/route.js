import { createClient } from '@supabase/supabase-js'

// Daily Vercel cron (see vercel.json): permanently deletes accounts whose
// 60-day deactivation window has expired. Vercel authenticates the request
// by sending `Authorization: Bearer ${CRON_SECRET}` when that env var is set.
//
// Per expired account: the freelancer profile row goes first (ON DELETE
// CASCADE clears services, reviews, messages, portfolio — with explicit
// fallback deletes like the admin route), then the user's own client-side
// data (sent messages, saved lists, subscriptions), then the auth user
// itself — which cascades the account_deactivations row.
export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'Not configured.' }, { status: 500 })
  const auth = request.headers.get('authorization') || ''
  if (auth !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)

  const { data: expired, error } = await admin
    .from('account_deactivations')
    .select('user_id, purge_after')
    .lt('purge_after', new Date().toISOString())
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = []
  for (const row of expired || []) {
    const uid = row.user_id
    try {
      // Freelancer profile + everything hanging off it
      const { data: fp } = await admin.from('freelancers').select('id').eq('user_id', uid).maybeSingle()
      if (fp) {
        await Promise.all([
          admin.from('services').delete().eq('freelancer_id', fp.id),
          admin.from('reviews').delete().eq('freelancer_id', fp.id),
          admin.from('portfolio_items').delete().eq('freelancer_id', fp.id),
          admin.from('quotes').delete().eq('freelancer_id', fp.id),
          admin.from('appointments').delete().eq('freelancer_id', fp.id),
          admin.from('availability_settings').delete().eq('freelancer_id', fp.id),
          admin.from('availability_blocks').delete().eq('freelancer_id', fp.id),
        ])
        const { data: msgs } = await admin.from('messages').select('id').eq('freelancer_id', fp.id)
        const msgIds = (msgs || []).map(m => m.id)
        if (msgIds.length) await admin.from('message_replies').delete().in('message_id', msgIds)
        await admin.from('messages').delete().eq('freelancer_id', fp.id)
        await admin.from('freelancers').delete().eq('id', fp.id)
      }

      // Conversations the user started as a client (their name/email live on
      // the messages rows)
      const { data: sent } = await admin.from('messages').select('id').eq('sender_user_id', uid)
      const sentIds = (sent || []).map(m => m.id)
      if (sentIds.length) {
        await admin.from('message_replies').delete().in('message_id', sentIds)
        await admin.from('messages').delete().in('id', sentIds)
      }

      // Personal data keyed on the auth user
      await Promise.all([
        admin.from('notifications').delete().eq('user_id', uid),
        admin.from('push_subscriptions').delete().eq('user_id', uid),
        admin.from('saved_professionals').delete().eq('user_id', uid),
        admin.from('saved_searches').delete().eq('user_id', uid),
        admin.from('client_profiles').delete().eq('user_id', uid),
        admin.from('appointments').delete().eq('client_user_id', uid),
      ])

      // Auth user last — cascades the account_deactivations row via FK
      const { error: delErr } = await admin.auth.admin.deleteUser(uid)
      if (delErr) throw delErr
      results.push({ user_id: uid, deleted: true })
    } catch (err) {
      console.error('[purge-deactivated] failed for', uid, '-', err.message)
      results.push({ user_id: uid, deleted: false, error: err.message })
    }
  }

  return Response.json({ checked: (expired || []).length, results })
}
