// Shared trust strip used on the homepage and About page.
//
// Default is the LIGHT variant: a quiet strip on the card surface with navy
// icons, so the hero above it is the only navy band at the top of the page
// (two stacked navy sections used to fight each other across the wave).
// The original navy look is kept as variant="navy" for anywhere that wants it.
export default function TrustBar({ variant = 'light' }) {
  const navy = variant === 'navy'
  const iconStroke = navy ? '#F9C000' : '#00267F'
  const iconFill = navy ? 'rgba(249,192,0,0.15)' : 'rgba(0,38,127,0.08)'
  const text = navy ? 'text-white' : 'text-gray-800'

  return (
    <section
      className="py-8 sm:py-10 px-4 sm:px-8"
      style={navy
        ? { background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }
        : { backgroundColor: 'var(--surface-card)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">

        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: iconFill }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={iconStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" stroke={iconStroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className={`${text} font-medium leading-snug text-sm sm:text-base`}>Every profile manually verified before going live</p>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: iconFill }}>
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F9C000" />
            </svg>
          </span>
          <p className={`${text} font-medium leading-snug text-sm sm:text-base`}>Two-way reviews: freelancers and clients both rated</p>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <span className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: iconFill }}>
            <img
              src="https://flagcdn.com/bb.svg"
              width="34"
              height="24"
              style={{ borderRadius: '3px', border: navy ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(0,38,127,0.15)' }}
              alt="Barbados flag"
            />
          </span>
          <p className={`${text} font-medium leading-snug text-sm sm:text-base`}>Built exclusively for Barbados, not a global platform</p>
        </div>

      </div>
    </section>
  )
}
