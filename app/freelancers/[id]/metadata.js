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

  const profileUrl = `https://vetted-bb.vercel.app/freelancers/${id}`
  const ogTitle = `${f.name} — ${f.trade} in Barbados | Vetted.bb`
  // First line of bio (up to first newline or sentence break), capped at 160 chars
  const firstLine = f.bio
    ? (f.bio.split(/\n|(?<=\.)\s/)[0] || f.bio).slice(0, 160)
    : `${f.trade} based in ${f.location || 'Barbados'}. Rated ${f.rating}/5 on Vetted.bb.`
  const ogDescription = firstLine.length === 160 ? firstLine + '…' : firstLine

  return {
    title: `${f.name} — ${f.trade} in ${f.location || 'Barbados'}`,
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: profileUrl,
      siteName: 'Vetted.bb',
      locale: 'en_BB',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: ogTitle,
      description: ogDescription,
    },
  }
}
