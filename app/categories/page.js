import { CATEGORIES } from '@/lib/categories'

export const metadata = {
  title: 'Browse All Categories — Trusted Professionals in Barbados',
  description: 'Browse every category of vetted professional in Barbados — trades, automotive, beauty, catering, technology and more. Real reviews, free quotes.',
  alternates: { canonical: 'https://vetted-bb.vercel.app/categories' },
}

export default function CategoriesIndex() {
  return (
    <main className="min-h-screen" style={{ background: '#F3F4F8' }}>
      <section style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }} className="px-4 sm:px-8 py-14 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Sora', sans-serif" }}>
            All categories
          </h1>
          <p className="text-base" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Every kind of professional on Vetted.bb — pick a category to see who&apos;s available.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cat => (
            <a
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all"
              style={{ borderTop: '3px solid #00267F', textDecoration: 'none' }}
            >
              <span className="text-3xl block mb-3">{cat.icon}</span>
              <p className="font-semibold mb-1" style={{ color: '#00267F', fontFamily: "'Sora', sans-serif" }}>{cat.name}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{cat.description}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
