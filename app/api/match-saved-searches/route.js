import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'
import { matchesSavedSearch } from '@/lib/savedSearchMatch'

// Called (fire-and-forget) when a freelancer profile is created. Scans saved
// searches and notifies each owner whose search matches the new freelancer.
// One notification per user per freelancer (dedupe_key).
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ ok: false })

    const { freelancer_id } = await request.json()
    if (!freelancer_id) return Response.json({ error: 'freelancer_id required' }, { status: 400 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: f } = await admin
      .from('freelancers')
      .select('id, user_id, name, trade, category, location, skills')
      .eq('id', freelancer_id)
      .maybeSingle()
    if (!f) return Response.json({ ok: true })

    const { data: searches } = await admin.from('saved_searches').select('id, user_id, query, category, location')
    if (!searches?.length) return Response.json({ ok: true })

    const notified = new Set()

    for (const s of searches) {
      if (s.user_id === f.user_id || notified.has(s.user_id)) continue
      if (!matchesSavedSearch(f, s)) continue

      notified.add(s.user_id)
      const label = f.trade || 'professional'
      const params = new URLSearchParams()
      if (s.query) params.set('q', s.query)
      if (s.category) params.set('category', s.category)
      const link = `/search${params.toString() ? `?${params}` : ''}`

      createNotification(s.user_id, {
        type: 'saved_search',
        title: `New ${label} on Vetted.bb matches your saved search`,
        body: `${f.name} just joined${f.location ? ` in ${f.location}` : ''}.`,
        link,
        dedupeKey: `ss:${s.user_id}:${f.id}`,
      })
      sendPushToUser(s.user_id, {
        title: `New ${label} matches your saved search`,
        body: `${f.name} just joined Vetted.bb.`,
        url: link,
      }).catch(() => {})
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
