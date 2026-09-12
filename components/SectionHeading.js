// One section header for the marketing pages, so every section opens the
// same way: a small gold eyebrow, a Sora title, an optional one-line sub.
// Two tones: "light" for sections on the page background, "dark" for
// sections on navy. Presentational only, so it works in server components.
export default function SectionHeading({ eyebrow, title, sub, align = 'left', tone = 'light', as: Tag = 'h2', className = 'mb-10' }) {
  const dark = tone === 'dark'
  return (
    <div className={className} style={{ textAlign: align }}>
      {eyebrow && (
        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: dark ? '#F9C000' : '#d9a800', marginBottom: '8px' }}>
          {eyebrow}
        </p>
      )}
      <Tag style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 'clamp(1.75rem, 3.5vw, 2.2rem)', letterSpacing: '-0.8px', color: dark ? '#ffffff' : '#00267F', marginBottom: sub ? '8px' : 0, lineHeight: 1.15 }}>
        {title}
      </Tag>
      {sub && (
        <p style={{ color: dark ? '#93b8ff' : '#6B7280', fontSize: '1rem', fontFamily: "'Inter', sans-serif", maxWidth: align === 'center' ? '40rem' : undefined, marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}
