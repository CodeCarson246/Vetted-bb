import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { rateLimit } from '@/lib/rateLimit'
import { signedInUser } from '@/lib/serverNotifyGuard'

// "Send a test notification" in Settings: a push to the signed-in person's
// OWN devices, and a plain answer about what happened, so a push that never
// arrives can be told apart from a server that is not set up to send one.
// Only ever sends to the caller's own subscriptions.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Server is not configured.' }, { status: 500 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const user = await signedInUser(admin, request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await rateLimit(`push-test:${user.id}`, { limit: 3, windowMs: 10 * 60_000 }))) {
      return Response.json({ error: 'Too many tests. Try again in a few minutes.' }, { status: 429 })
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    // Which settings the server is missing, by name only (never the values).
    const missing = [
      !vapidPublic && 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
      !vapidPrivate && 'VAPID_PRIVATE_KEY',
    ].filter(Boolean)
    if (missing.length) return Response.json({ configured: false, missing, devices: [] })

    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@vetted.bb', vapidPublic, vapidPrivate)
    } catch (err) {
      return Response.json({ configured: false, missing: [], keyError: String(err.message || err).slice(0, 200), devices: [] })
    }

    const { data: subs } = await admin.from('push_subscriptions').select('id, subscription').eq('user_id', user.id)
    const devices = await Promise.all((subs || []).map(async row => {
      let service = 'unknown'
      try { service = new URL(row.subscription?.endpoint).host } catch { /* keep unknown */ }
      try {
        const res = await webpush.sendNotification(row.subscription, JSON.stringify({
          title: 'Vetted.bb test notification',
          body: 'Push notifications are working on this device.',
          url: '/settings',
        }), { timeout: 8000, TTL: 600, urgency: 'high' })
        return { service, ok: true, status: res.statusCode }
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', row.id)
          return { service, ok: false, status: err.statusCode, reason: 'This device had turned notifications off; it has been removed.' }
        }
        return { service, ok: false, status: err.statusCode || null, reason: String(err.body || err.message || 'failed').slice(0, 200) }
      }
    }))
    return Response.json({ configured: true, devices })
  } catch (err) {
    console.error('push-test failed', err)
    return Response.json({ error: 'Could not run the test.' }, { status: 500 })
  }
}
