import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }) {
  const { id } = await params
  const { data: f } = await supabase
    .from('freelancers')
    .select('name, trade, location, bio, rating, review_count, verified')
    .eq('id', id)
    .single()

  if (!f) {
    return {
      title: 'Freelancer Profile',
      description: 'View this freelancer profile on Vetted.bb',
    }
  }

  const title = `${f.name} — ${f.trade} in ${f.location || 'Barbados'}`
  const description = f.bio
    ? `${f.bio.slice(0, 140)}${f.bio.length > 140 ? '...' : ''} — ${f.trade} based in ${f.location || 'Barbados'}. Rated ${f.rating}/5 from ${f.review_count} reviews on Vetted.bb.`
    : `${f.trade} based in ${f.location || 'Barbados'}. Rated ${f.rating}/5 from ${f.review_count} reviews on Vetted.bb.`

  return {
    title,
    description,
    openGraph: {
      title: `${f.name} — ${f.trade} | Vetted.bb`,
      description,
      url: `https://vetted-bb.vercel.app/freelancers/${id}`,
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${f.name} — ${f.trade} | Vetted.bb`,
      description,
    },
  }
}
