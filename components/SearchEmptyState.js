// SearchEmptyState — shown on the search page when a query or category
// returns zero matching freelancers.
//
// Props:
//   query    — the raw search string the user typed (or the category keywords)
//   category — the human-readable category name, when triggered by a tile click
//              If present it takes precedence for headline/subline copy.

export default function SearchEmptyState({ query, category }) {
  const isCategory = !!category

  const headline = isCategory
    ? "Nobody here yet — but they're coming."
    : `No results for "${query}"`

  const subline = isCategory
    ? "This category is still filling up. Check back soon, or be the first professional to list your services here."
    : "Try a different search, or browse all categories below."

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center text-center px-8 py-20"
    >
      {/* Icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-7 flex-shrink-0"
        style={{ backgroundColor: '#EEF2FF' }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00267F"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* Category label — only shown for category searches */}
      {isCategory && (
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: '#00267F' }}
        >
          {category}
        </p>
      )}

      {/* Headline */}
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 max-w-sm leading-snug">
        {headline}
      </h2>

      {/* Sub-line */}
      <p className="text-gray-500 text-sm leading-relaxed max-w-md mb-10">
        {subline}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto">
        <a
          href="/signup"
          className="px-7 py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#F9C000', color: '#00267F' }}
        >
          List Your Services Free
        </a>
        <a
          href="/search"
          className="px-7 py-3 rounded-full font-semibold text-sm border-2 transition-opacity hover:opacity-70"
          style={{ borderColor: '#00267F', color: '#00267F' }}
        >
          Browse All Professionals
        </a>
      </div>

      {/* Reassurance */}
      <p className="text-xs text-gray-400 mt-7">
        New professionals join Vetted every week.
      </p>
    </div>
  )
}
