import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'

export const REVIEW_MIN_CHARS = 30
const COMMENT_MAX_CHARS = 3000

// This route uses the service-role key (bypasses RLS), so it must do
// its own auth: verify the caller's JWT, derive identity server-side,
// and never trust author/type/date from the request body.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for reviews.' }, { status: 500 })
    }

    // ── Authenticate the caller ──
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return Response.json({ error: 'You must be logged in to leave a review.' }, { status: 401 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 })
    }

    if (!rateLimit(`reviews:${user.id}`, { limit: 5, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many reviews submitted. Please try again later.' }, { status: 429 })
    }

    // ── Validate input ──
    const { freelancer_id, rating, comment, service_name, image_url } = await request.json()

    if (!freelancer_id) {
      return Response.json({ error: 'freelancer_id is required.' }, { status: 400 })
    }
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: 'A star rating is required.' }, { status: 400 })
    }
    if (!comment || comment.trim().length < REVIEW_MIN_CHARS) {
      return Response.json(
        { error: `Please write at least ${REVIEW_MIN_CHARS} characters so your review is useful to others.` },
        { status: 400 }
      )
    }
    if (comment.length > COMMENT_MAX_CHARS) {
      return Response.json({ error: 'Review is too long.' }, { status: 400 })
    }

    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('id, user_id')
      .eq('id', freelancer_id)
      .maybeSingle()
    if (!freelancer) {
      return Response.json({ error: 'Freelancer not found.' }, { status: 404 })
    }
    if (freelancer.user_id === user.id) {
      return Response.json({ error: 'You cannot review your own profile.' }, { status: 403 })
    }

    // Integrity gate: a client can review only once a job between them is
    // both mutually completed (freelancer + client confirmations) AND marked
    // PAID by the freelancer.
    const { data: doneJob } = await supabase
      .from('quotes')
      .select('id')
      .eq('freelancer_id', freelancer_id)
      .eq('client_email', user.email)
      .eq('status', 'paid')
      .not('paid_at', 'is', null)
      .not('completed_at', 'is', null)
      .not('client_completed_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (!doneJob) {
      return Response.json(
        { error: 'You can review this professional once you have both marked the job completed and they have marked it paid.' },
        { status: 403 },
      )
    }

    // One client review per user per freelancer
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('freelancer_id', freelancer_id)
      .eq('author_user_id', user.id)
      .eq('type', 'client')
      .maybeSingle()
    if (existing) {
      return Response.json({ error: 'You have already reviewed this professional.' }, { status: 409 })
    }

    // ── Derive identity server-side ──
    let author = user.user_metadata?.full_name
    if (!author) {
      const { data: fp } = await supabase
        .from('freelancers')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle()
      author = fp?.name
    }
    if (!author) author = user.email?.split('@')[0] || 'Vetted user'

    // Only accept photos that live in our own review-photos bucket
    let safeImageUrl = null
    if (typeof image_url === 'string' && image_url) {
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/review-photos/`
      if (image_url.startsWith(prefix)) safeImageUrl = image_url
    }

    const { error: insertError } = await supabase.from('reviews').insert({
      freelancer_id,
      author,
      author_user_id: user.id,
      rating,
      comment: comment.trim(),
      service_name: typeof service_name === 'string' && service_name ? service_name.slice(0, 200) : null,
      type: 'client',
      date: new Date().toISOString().split('T')[0],
      image_url: safeImageUrl,
    })

    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    // Recalculate and persist the freelancer's aggregate rating
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('freelancer_id', freelancer_id)
      .eq('type', 'client')

    if (allReviews) {
      const count = allReviews.length
      const avg = count > 0
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : 0
      await supabase.from('freelancers').update({ rating: avg, review_count: count }).eq('id', freelancer_id)
    }

    // Notify the reviewed freelancer (fire-and-forget)
    createNotification(freelancer.user_id, {
      type: 'review',
      title: `${author} left you a ${rating}-star review`,
      body: comment.trim().slice(0, 140),
      link: '/dashboard?tab=reviews',
    })
    sendPushToUser(freelancer.user_id, {
      title: `${author} left you a ${rating}-star review`,
      body: comment.trim().slice(0, 120),
      url: '/dashboard?tab=reviews',
    }).catch(() => {})

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
