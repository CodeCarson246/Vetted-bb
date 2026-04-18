export default function SearchEmptyState({ query, category, onClearFilters }) {
  const isCategory = !!category

  const headline = isCategory
    ? "Nobody here yet — but they're coming."
    : "No professionals found"

  const subline = isCategory
    ? "This category is still filling up. Check back soon, or be the first professional to list your services here."
    : "No professionals found matching your search. Try adjusting your filters or browse all categories."

  return (
    <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center text-center px-8 py-20">
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

      {isCategory && (
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#00267F' }}>
          {category}
        </p>
      )}

      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 max-w-sm leading-snug">
        {headline}
      </h2>

      <p className="text-sm leading-relaxed max-w-md mb-10" style={{ color: '#6B7280', fontFamily: "'Inter', sans-serif" }}>
        {subline}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto">
        {!isCategory && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="px-7 py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90 border-2"
            style={{ borderColor: '#00267F', color: '#00267F', backgroundColor: 'white' }}
          >
            Clear Filters
          </button>
        )}
        <a
          href="/signup?role=freelancer"
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

      <p className="text-xs text-gray-400 mt-7">
        New professionals join Vetted every week.
      </p>
    </div>
  )
}
