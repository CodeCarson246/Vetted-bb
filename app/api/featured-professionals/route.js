import { createClient } from '@supabase/supabase-js'
import { lowestPaidPrice } from '@/lib/price'

// Cache this response at the Next.js edge for 1 hour.
// Revalidates in the background — no request ever waits for a fresh query.
export const revalidate = 3600

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  // Admin-featured freelancers lead, then best-rated fill the rest
  const { data, error } = await supabase
    .from('freelancers')
    .select('id, name, trade, avatar_url, location, rating, review_count, available, skills, bio, featured, verified, phone_verified, rising_since, services(price)')
    .eq('available', true)
    .eq('hidden', false)
    .is('deactivated_at', null)
    .order('featured', { ascending: false })
    .order('rating', { ascending: false })
    .order('review_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // The "From" figure is worked out from the live services rather than read
  // from freelancers.min_price. That column is only recalculated when a
  // service is saved, so it goes stale (and historically counted free
  // services, printing "From Bds$0" on anyone offering a free consultation).
  const withPrice = (data || []).map(({ services, ...f }) => ({
    ...f,
    min_price: lowestPaidPrice(services),
  }))
  return Response.json({ data: withPrice })
}
