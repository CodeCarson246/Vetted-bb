import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

/**
 * Server-only: browser push to every device a user enabled
 * notifications on. Requires the service-role key (subscriptions are
 * RLS-protected) and VAPID keys; silently skips if either is missing.
 * Expired/revoked subscriptions (404/410) are pruned as we go.
 */
export async function sendPushToUser(userId, payload) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!serviceKey || !vapidPublic || !vapidPrivate || !userId) return

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@vetted.bb',
    vapidPublic,
    vapidPrivate,
  )

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  await Promise.all((subs || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload))
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription gone — prune it
        await admin.from('push_subscriptions').delete().eq('id', row.id)
      } else {
        // Surface the real reason in server logs. A 401/403 here almost
        // always means the VAPID public key on the subscription doesn't pair
        // with VAPID_PRIVATE_KEY on the server.
        console.error('[push] send failed:', err.statusCode, err.body || err.message)
      }
    }
  }))
}
