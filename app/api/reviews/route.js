import { createClient } from '@supabase/supabase-js'

export const REVIEW_MIN_CHARS = 30

export async function POST(request) {
  try {
    const { freelancer_id, author, rating, comment, service_name, type, date } = await request.json()

    // Server-side validation — cannot be bypassed by the client
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: 'A star rating is required.' }, { status: 400 })
    }
    if (!comment || comment.trim().length < REVIEW_MIN_CHARS) {
      return Response.json(
        { error: `Please write at least ${REVIEW_MIN_CHARS} characters so your review is useful to others.` },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { error: insertError } = await supabase.from('reviews').insert({
      freelancer_id,
      author,
      rating,
      comment: comment.trim(),
      service_name: service_name || null,
      type,
      date,
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

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
