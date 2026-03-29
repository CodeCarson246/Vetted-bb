// Shared navy trust bar used on the homepage and About page.
// Navy background, yellow SVG icons, white statement text.
export default function TrustBar() {
  return (
    <section className="py-10 px-4 sm:px-8" style={{ background: 'linear-gradient(135deg, #00267F 0%, #001a5c 100%)' }}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10">

        <div className="flex flex-col items-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F9C000" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="rgba(249,192,0,0.15)"/>
          </svg>
          <p className="text-white font-medium leading-snug text-sm sm:text-base">Every profile manually verified before going live</p>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F9C000"/>
          </svg>
          <p className="text-white font-medium leading-snug text-sm sm:text-base">Two-way reviews: freelancers and clients both rated</p>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <img
            src="https://flagcdn.com/bb.svg"
            width="56"
            height="40"
            style={{ borderRadius: '4px', border: '1px solid rgba(255,255,255,0.25)' }}
            alt="Barbados flag"
          />
          <p className="text-white font-medium leading-snug text-sm sm:text-base">Built exclusively for Barbados, not a global platform</p>
        </div>

      </div>
    </section>
  )
}
