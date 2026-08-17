import { supabase } from '@/lib/supabase'
import { formatParish } from '@/lib/formatParish'
import { SITE_URL } from '@/lib/siteUrl'

export async function generateMetadata({ params }) {
  const { id } = await params
  const { data: f } = await supabase
    .from('freelancers')
    .select('name, trade, location, bio, rating, review_count, verified, hidden, deactivated_at')
    .eq('id', id)
    .single()

  if (!f || f.hidden || f.deactivated_at) {
    return {
      title: 'Freelancer Profile',
      description: 'View this freelancer profile on Vetted.bb',
      robots: { index: false },
    }
  }

  const profileUrl = `${SITE_URL}/freelancers/${id}`
  const ogTitle = `${f.name}, ${f.trade} in Barbados | Vetted.bb`
  // First line of bio (up to first newline or sentence break), capped at 160 chars
  const firstLine = f.bio
    ? (f.bio.split(/\n|(?<=\.)\s/)[0] || f.bio).slice(0, 160)
    : `${f.trade} based in ${formatParish(f.location) || 'Barbados'}. Rated ${f.rating}/5 on Vetted.bb.`
  const ogDescription = firstLine.length === 160 ? firstLine + '…' : firstLine

  return {
    title: `${f.name}, ${f.trade} in ${formatParish(f.location) || 'Barbados'}`,
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: profileUrl,
      siteName: 'Vetted.bb',
      locale: 'en_BB',
      type: 'profile',
      // A page-level openGraph replaces (not merges with) the root one, so
      // the site default image must be restated here for share previews.
      // JPEG (not PNG): WhatsApp renders a transparency-free JPEG as a large
      // banner instead of the small cropped thumbnail it uses for PNGs.
      images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, type: 'image/jpeg', alt: `${f.name} on Vetted.bb` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [`${SITE_URL}/og-image.jpg`],
    },
  }
}
