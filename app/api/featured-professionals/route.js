import { createClient } from '@supabase/supabase-js'

// Cache this response at the Next.js edge for 1 hour.
// Revalidates in the background — no request ever waits for a fresh query.
export const revalidate = 3600

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const { data, error } = await supabase
    .from('freelancers')
    .select('id, name, trade, avatar_url, location, rating, review_count, available, skills, bio, min_price')
    .eq('available', true)
    .order('rating', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data || [] })
}
