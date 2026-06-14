import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'

// Generates the once-a-day "N people viewed your profile today" digest for the
// caller (if they're a freelancer and had views today). Idempotent via a
// per-day dedupe_key, so the bell can call it on every load safely.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ ok: false })

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: freelancer } = await admin
      .from('freelancers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!freelancer) return Response.json({ ok: true }) // clients have no profile views

    // Barbados is UTC-4; "today" starts at 04:00 UTC.
    const now = new Date()
    const astMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0))
    if (now < astMidnightUtc) astMidnightUtc.setUTCDate(astMidnightUtc.getUTCDate() - 1)
    const dayKey = new Date(astMidnightUtc.getTime() - 4 * 3600_000).toISOString().slice(0, 10)

    const { count } = await admin
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('freelancer_id', freelancer.id)
      .gte('viewed_at', astMidnightUtc.toISOString())

    if (count && count > 0) {
      createNotification(user.id, {
        type: 'profile_views',
        title: `${count} ${count === 1 ? 'person' : 'people'} viewed your profile today`,
        body: 'Keep your profile fresh to turn views into enquiries.',
        link: '/dashboard',
        dedupeKey: `pv:${freelancer.id}:${dayKey}`,
      })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
