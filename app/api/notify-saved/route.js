import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'

// A client saved/favourited a freelancer → notify the freelancer, once per
// client+freelancer pair (dedupe_key) so toggling save off/on doesn't spam.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    if (!rateLimit(`saved:${clientIp(request)}`, { limit: 30, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { freelancer_id } = await request.json()
    if (!freelancer_id) return Response.json({ error: 'freelancer_id required' }, { status: 400 })

    const { data: freelancer } = await admin
      .from('freelancers')
      .select('user_id')
      .eq('id', freelancer_id)
      .maybeSingle()
    if (!freelancer?.user_id || freelancer.user_id === user.id) {
      return Response.json({ success: true }) // self-save or missing → no-op
    }

    const saverName = user.user_metadata?.full_name || 'Someone'
    await createNotification(freelancer.user_id, {
      type: 'saved',
      title: `${saverName} saved your profile`,
      body: 'A client added you to their saved professionals.',
      link: '/dashboard',
      dedupeKey: `saved:${user.id}:${freelancer_id}`,
    })
    sendPushToUser(freelancer.user_id, {
      title: `${saverName} saved your profile`,
      body: 'A client added you to their saved professionals.',
      url: '/dashboard',
    }).catch(() => {})

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
