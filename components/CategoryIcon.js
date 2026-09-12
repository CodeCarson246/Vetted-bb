// Line icons for the category catalogue, one per slug in lib/categories.js.
// Replaces the emoji, which rendered differently on every OS and read as
// consumer. Single stroke weight, currentColor, so the same icon works in
// navy on a pale tile, or in white on the navy category hero.
// Presentational only: safe in server components.
const PATHS = {
  'trades-construction': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-2.1 2.7-2.6z',
  'ac-solar': 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  'landscaping-outdoors': 'M5 19C5 11 11 5 19 5c0 8-6 14-14 14zM5 19l7-7',
  'automotive': 'M5 17h14M6 17l1.5-5h9L18 17M4 17v2M20 17v2M8.5 12l.8-3h5.4l.8 3M7.5 14.5h.01M16.5 14.5h.01',
  'cleaning-domestic': 'M9 3v4M6 5h6M9 7l-3 10h6L9 7M7 21h4M15 12h5M15 16h5M15 20h5',
  'beauty-wellness': 'M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM20 4L8 16M20 20L8 8',
  'food-catering': 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 3 3 3v9',
  'sports-fitness': 'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
  'creative-design': 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 1-3 1-4a9 9 0 0 0-7-8zM8 10h.01M11 7h.01M15 8h.01',
  'technology': 'M4 6h16v10H4zM2 19h20M10 19v-3M14 19v-3',
  'events-entertainment': 'M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM9 18V5l10-2v12M19 15a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  'education-tutoring': 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM9 7h7M9 11h7',
  'business-professional': 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  'health-care': 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.7z',
  'other': 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
}

export default function CategoryIcon({ slug, size = 28, color = 'currentColor', strokeWidth = 1.8, style, className }) {
  const d = PATHS[slug] || PATHS.other
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <path d={d} />
    </svg>
  )
}
