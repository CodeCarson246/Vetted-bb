import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

const MAX = 2000

// A freelancer posts/edits/clears a public response to a review about them.
// Service-role write (reviews has no client UPDATE policy); the caller must
// own the freelancer profile the review is attached to.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!rateLimit(`review-response:${user.id}`, { limit: 20, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many updates. Please try again later.' }, { status: 429 })
    }

    const { review_id, response } = await request.json()
    if (!review_id) return Response.json({ error: 'review_id required' }, { status: 400 })
    const text = typeof response === 'string' ? response.trim().slice(0, MAX) : ''

    // The review must be about a freelancer profile owned by the caller
    const { data: review } = await admin
      .from('reviews')
      .select('id, freelancer_id, freelancers(user_id)')
      .eq('id', review_id)
      .maybeSingle()
    if (!review) return Response.json({ error: 'Review not found' }, { status: 404 })
    if (review.freelancers?.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('reviews')
      .update({ response: text || null, response_at: text ? new Date().toISOString() : null })
      .eq('id', review_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
