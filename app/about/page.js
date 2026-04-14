import TrustBar from '@/components/TrustBar'

export default function About() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="w-full py-16 px-4 sm:px-8 text-center" style={{ background: 'linear-gradient(to bottom right, #00267F, #001a5c)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#F9C000' }}>Our story</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            Built for Barbados.<br />By people who live here.
          </h1>
          <p className="text-base sm:text-lg" style={{ color: '#93b8ff' }}>
            Vetted.bb exists because finding a reliable freelancer in Barbados shouldn't be a guessing game.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 flex flex-col gap-12">

        {/* The problem */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #00267F' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">The problem we set out to solve</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Anyone who has lived in Barbados knows the drill. You need a plumber, an electrician, a graphic designer, so you ask around. You get a WhatsApp number from a friend of a friend. You send a message and hope for the best.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Sometimes it works out. Sometimes you wait three weeks for a callback that never comes. There was no central place to find trusted local talent, read honest reviews, and make an informed decision. Until now.
          </p>
        </div>

      </div>

      {/* What makes us different */}
      <TrustBar />

      {/* Remaining content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-14 flex flex-col gap-12">

        {/* For freelancers */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #F9C000' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">For freelancers</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            If you are a skilled tradesperson, creative, or professional based in Barbados, Vetted.bb gives you a free professional profile where clients can find you, see your work, and reach out directly.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Free to join. Built to grow with you and the Barbados professional community.
          </p>
          <a
            href="/signup?role=freelancer"
            className="inline-block text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#00267F' }}
          >
            Create your free profile →
          </a>
        </div>

        {/* For clients */}
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-8" style={{ borderLeft: '4px solid #00267F' }}>
          <h2 className="text-xl font-bold text-gray-900 mb-4">For clients</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Search by trade, read reviews from real clients, and contact a freelancer directly. All in one place. Whether you need someone today or are planning ahead, Vetted.bb makes it easy to find the right person with confidence.
          </p>
          <a
            href="/search"
            className="inline-block font-semibold px-6 py-3 rounded-full hover:opacity-80 transition-opacity border-2"
            style={{ color: '#00267F', borderColor: '#00267F' }}
          >
            Browse freelancers →
          </a>
        </div>

      </div>

    </main>
  )
}
