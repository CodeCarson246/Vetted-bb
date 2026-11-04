import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'

const COMMENT_MAX_CHARS = 3000

// Freelancer → client reviews. The mirror of /api/reviews, and it exists for
// the same reason: the reviews table takes writes only from the service role,
// so the "did these two actually work together?" check cannot be skipped by
// posting straight to the database with the public anon key.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for reviews.' }, { status: 500 })
    }

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

    if (!rateLimit(`client-review:${user.id}`, { limit: 5, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many reviews submitted. Please try again later.' }, { status: 429 })
    }

    const { client_user_id, rating, comment } = await request.json()

    if (!client_user_id) {
      return Response.json({ error: 'Please choose which client you want to review.' }, { status: 400 })
    }
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: 'A star rating is required.' }, { status: 400 })
    }
    if (!comment || !comment.trim()) {
      return Response.json({ error: 'Please write a few words about working with this client.' }, { status: 400 })
    }
    if (comment.length > COMMENT_MAX_CHARS) {
      return Response.json({ error: 'Review is too long.' }, { status: 400 })
    }

    // The caller must own a freelancer profile; the review is filed under it.
    const { data: freelancer } = await supabase
      .from('freelancers')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!freelancer) {
      return Response.json({ error: 'Only a professional profile can review a client.' }, { status: 403 })
    }
    if (client_user_id === user.id) {
      return Response.json({ error: 'You cannot review yourself.' }, { status: 403 })
    }

    // Integrity gate: there must be a job between these two that BOTH sides
    // marked completed. Payment is deliberately not required here — a client
    // who never paid is exactly the one other professionals need warned about.
    const { data: thread } = await supabase
      .from('messages')
      .select('sender_name, sender_email')
      .eq('freelancer_id', freelancer.id)
      .eq('sender_user_id', client_user_id)
      .limit(1)
      .maybeSingle()
    if (!thread?.sender_email) {
      return Response.json({ error: 'You have no completed job with this client.' }, { status: 403 })
    }

    const { data: doneJob } = await supabase
      .from('quotes')
      .select('id')
      .eq('freelancer_id', freelancer.id)
      .ilike('client_email', thread.sender_email)
      .not('completed_at', 'is', null)
      .not('client_completed_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (!doneJob) {
      return Response.json(
        { error: 'You can review this client once you have both marked the job completed.' },
        { status: 403 },
      )
    }

    // One review per client per freelancer
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('freelancer_id', freelancer.id)
      .eq('client_user_id', client_user_id)
      .eq('type', 'freelancer')
      .maybeSingle()
    if (existing) {
      return Response.json({ error: 'You have already reviewed this client.' }, { status: 409 })
    }

    const { error: insertError } = await supabase.from('reviews').insert({
      freelancer_id: freelancer.id,
      author: thread.sender_name || 'Client',
      author_user_id: user.id,
      client_user_id,
      rating,
      comment: comment.trim(),
      type: 'freelancer',
      date: new Date().toISOString().split('T')[0],
    })
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

    await createNotification(client_user_id, {
      type: 'review',
      title: `${freelancer.name} left you a ${rating}-star review`,
      body: comment.trim().slice(0, 140),
      link: '/dashboard',
    })
    sendPushToUser(client_user_id, {
      title: `${freelancer.name} left you a ${rating}-star review`,
      body: comment.trim().slice(0, 120),
      url: '/dashboard',
    }).catch(() => {})

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
