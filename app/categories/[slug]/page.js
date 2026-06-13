import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { CATEGORIES, categoryBySlug } from '@/lib/categories'
import { formatParish } from '@/lib/formatParish'
import { parsePrice } from '@/lib/price'
import VerifiedBadge, { isVerified } from '@/components/VerifiedBadge'

// Server-rendered + ISR: Google gets full HTML, revalidated hourly.
export const revalidate = 3600

export function generateStaticParams() {
  return CATEGORIES.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const cat = categoryBySlug(slug)
  if (!cat) return {}
  return {
    title: `${cat.name} in Barbados — Hire Trusted Professionals`,
    description: `${cat.description} Real reviews, verified profiles, free quotes on Vetted.bb.`,
    alternates: { canonical: `https://vetted-bb.vercel.app/categories/${cat.slug}` },
    openGraph: {
      title: `${cat.name} in Barbados | Vetted.bb`,
      description: cat.description,
    },
  }
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

function StarRow({ rating }) {
  return (
    <span style={{ color: '#F9C000', fontSize: '0.85rem', letterSpacing: 1 }}>
      {'★'.repeat(Math.round(rating || 0))}
      <span style={{ color: '#e5e7eb' }}>{'★'.repeat(5 - Math.round(rating || 0))}</span>
    </span>
  )
}

export default async function CategoryPage({ params }) {
  const { slug } = await params
  const cat = categoryBySlug(slug)
  if (!cat) notFound()

  const { data: freelancers } = await sb()
    .from('freelancers')
    .select('id, name, trade, avatar_url, location, rating, review_count, available, bio, verified, phone_verified, services(price)')
    .eq('category', cat.name)
    .order('rating', { ascending: false })
    .order('review_count', { ascending: false })

  const pros = freelancers || []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.name} professionals in Barbados`,
    numberOfItems: pros.length,
    itemListElement: pros.slice(0, 10).map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://vetted-bb.vercel.app/freelancers/${f.id}`,
      name: f.name,
    })),
  }

  return (
    <main className="min-h-screen page-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }} className="px-4 sm:px-8 py-14 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="text-4xl block mb-4">{cat.icon}</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
            {cat.name} in Barbados
          </h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.75)' }}>{cat.description}</p>
          <p className="text-sm mt-4" style={{ color: '#F9C000' }}>
            {pros.length > 0
              ? `${pros.length} vetted professional${pros.length === 1 ? '' : 's'} ready to hire`
              : 'Be the first professional listed in this category'}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
        {pros.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <p className="font-medium text-gray-900 mb-1">No professionals listed yet</p>
            <p className="text-sm text-gray-500 mb-6">Work in this field? Claim the spot — early profiles get the most visibility.</p>
            <a
              href="/signup?role=freelancer"
              className="inline-block text-sm font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}
            >
              Create your free profile →
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pros.map(f => {
              const prices = (f.services || []).map(s => parsePrice(s.price)).filter(p => p !== null)
              const minPrice = prices.length > 0 ? Math.min(...prices) : null
              const initials = (f.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)
              return (
                <a
                  key={f.id}
                  href={`/freelancers/${f.id}`}
                  className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                  style={{ borderLeft: '4px solid #00267F', textDecoration: 'none' }}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: '#00267F' }}>
                    {f.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold capitalize" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{f.name}</span>
                      {isVerified(f) && <VerifiedBadge size={15} />}
                      <span className={`text-xs font-medium ${f.available ? 'text-green-600' : 'text-gray-400'}`}>
                        ● {f.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 capitalize mt-0.5">
                      {f.trade}{f.location ? ` · ${formatParish(f.location)}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRow rating={f.rating} />
                      <span className="text-xs text-gray-400">({f.review_count || 0})</span>
                      {minPrice !== null && (
                        <span className="text-xs text-gray-400">· from ${minPrice.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-4 py-2 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    View profile
                  </span>
                </a>
              )
            })}
          </div>
        )}

        {/* Refine + cross-links */}
        <div className="text-center mt-8">
          <a
            href={`/search?q=${encodeURIComponent(cat.searchQuery)}&category=${encodeURIComponent(cat.name)}`}
            className="text-sm font-semibold hover:opacity-80"
            style={{ color: '#00267F' }}
          >
            Filter by parish, budget and availability in search →
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Browse other categories</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter(c => c.slug !== cat.slug).map(c => (
              <a
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="text-xs font-medium px-3.5 py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
                style={{ textDecoration: 'none' }}
              >
                {c.icon} {c.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
