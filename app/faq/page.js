'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-7 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-7 pb-6 text-gray-500 text-sm leading-relaxed border-t border-gray-100 pt-4">
          {answer}
        </div>
      )}
    </div>
  )
}

const faqs = [
  {
    section: 'General',
    items: [
      {
        question: 'What is Vetted.bb?',
        answer: 'Vetted.bb is a freelancer marketplace built exclusively for Barbados. It connects clients with skilled local freelancers across trades, creative work, technology, health, and more, all in one place.',
      },
      {
        question: 'Is Vetted.bb free to use?',
        answer: 'Yes. Creating a client account, browsing freelancers, and contacting them is completely free. Freelancers can also create and maintain their profiles at no cost. We do not charge commission on any work arranged through the platform.',
      },
      {
        question: 'Is this only for Barbados?',
        answer: 'Yes, intentionally. Vetted.bb is built specifically for the Barbados community. Every freelancer on the platform is based on the island. This keeps the experience relevant and makes it easier to find someone nearby.',
      },
    ],
  },
  {
    section: 'For clients',
    items: [
      {
        question: 'How do I find a freelancer?',
        answer: 'Use the search bar on the homepage or the Browse page to search by trade, skill, or name. You can filter results by availability, price range, and location. Click any profile to read reviews and see their services.',
      },
      {
        question: 'How do I contact a freelancer?',
        answer: 'Once you find someone you like, click the Contact button on their profile. You will need to be logged in to send a message. Your message goes directly to the freelancer\'s inbox on Vetted.bb.',
      },
      {
        question: 'Can I leave a review?',
        answer: 'Yes. After working with a freelancer, visit their profile while logged in and use the Leave a review form. Your review helps other clients make informed decisions and helps good freelancers build their reputation.',
      },
      {
        question: 'Are freelancers background checked?',
        answer: 'Vetted.bb does not currently conduct formal background checks. However, the two-way review system means that freelancers build a public track record over time. We recommend reading reviews carefully and starting with a smaller job before committing to larger projects.',
      },
    ],
  },
  {
    section: 'For freelancers',
    items: [
      {
        question: 'How do I create a profile?',
        answer: 'Sign up for a free account and select Freelancer when prompted. You will then be guided through a short setup to add your trade, location, bio, price tier, and services. The whole process takes about two minutes.',
      },
      {
        question: 'Can I add photos of my past work?',
        answer: 'Yes. When adding or editing a service on your dashboard, you can upload up to 6 photos of previous work for that service. These appear on your public profile and help clients see the quality of what you offer before reaching out.',
      },
      {
        question: 'How do clients find me?',
        answer: 'Clients can search by trade, skill, or name on the Browse page. Your profile also appears in category searches. Make sure your bio is detailed, your skills are listed accurately, and your services are up to date to improve how often you appear.',
      },
      {
        question: 'Can I review a client I worked with?',
        answer: 'Yes. This is one of Vetted.bb\'s most important features. From your dashboard, go to the Leave a review tab to rate a client you worked with. This helps other freelancers on the platform know what to expect.',
      },
      {
        question: 'What happens when a client contacts me?',
        answer: 'You will receive their message in your Vetted.bb inbox, which you can access via the envelope icon in the top navigation bar. You can then follow up with them directly via email or phone using the details they provided.',
      },
    ],
  },
]

export default function FAQ() {
  const [user, setUser] = useState(null)
  const [freelancerProfile, setFreelancerProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setUser(u)
      if (u && u.user_metadata?.role !== 'client') {
        const { data: fp } = await supabase.from('freelancers').select('id, name, avatar_url').eq('user_id', u.id).single()
        setFreelancerProfile(fp || null)
        if (fp) {
          const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('freelancer_id', fp.id).eq('read', false)
          setUnreadCount(count || 0)
        }
      }
    })
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-6">
            <a href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</a>
            <a href="/search" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <span className="hidden sm:inline">Browse Professionals</span>
              <span className="sm:hidden">Browse</span>
            </a>
          </div>
          <div className="hidden sm:flex gap-4 items-center">
            {user ? (
              <>
                {freelancerProfile ? (
                  <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                      {freelancerProfile.avatar_url
                        ? <img src={freelancerProfile.avatar_url} alt={freelancerProfile.name} className="w-full h-full object-cover" />
                        : freelancerProfile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-gray-600 text-sm font-medium">{freelancerProfile.name}</span>
                  </a>
                ) : (
                  <a href="/dashboard" className="text-gray-600 text-sm font-medium hover:text-gray-900">{user?.user_metadata?.full_name || user?.email}</a>
                )}
                {freelancerProfile ? (
                  <a href="/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </a>
                ) : user && (
                  <a href="/messages" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors" title="My messages">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                  className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#00267F' }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
                <a href="/signup" className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
          <button className="sm:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
            {user ? (
              <>
                <a href="/dashboard" className="text-gray-700 font-medium">My dashboard</a>
                {freelancerProfile ? (
                  <a href="/inbox" className="text-gray-700 font-medium">Inbox</a>
                ) : user && (
                  <a href="/messages" className="text-gray-700 font-medium">My messages</a>
                )}
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-left text-red-500 font-medium">Log out</button>
              </>
            ) : (
              <>
                <a href="/search" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">Browse freelancers</a>
                <a href="/signup" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">List your services</a>
                <a href="/login" onClick={() => setMenuOpen(false)} className="text-gray-700 font-medium">Log in</a>
                <a href="/signup" onClick={() => setMenuOpen(false)} className="font-medium" style={{ color: '#00267F' }}>Sign up</a>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Hero */}
      <div className="w-full py-14 px-4 sm:px-8 text-center" style={{ background: 'linear-gradient(to bottom right, #00267F, #001a5c)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: '#F9C000' }}>Help centre</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Frequently asked questions</h1>
          <p className="text-base" style={{ color: '#93b8ff' }}>Everything you need to know about Vetted.bb</p>
        </div>
      </div>

      {/* FAQ sections */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 flex flex-col gap-10">
        {faqs.map(section => (
          <div key={section.section}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#00267F' }}>{section.section}</h2>
            <div className="flex flex-col gap-3">
              {section.items.map(item => (
                <FAQItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div className="rounded-2xl px-8 py-8 text-center" style={{ backgroundColor: '#00267F' }}>
          <h3 className="text-xl font-bold text-white mb-2">Still have a question?</h3>
          <p className="mb-6" style={{ color: '#93b8ff' }}>We are a small team and happy to help directly.</p>
          <a
            href="mailto:hello@vetted.bb"
            className="inline-block font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#F9C000', color: '#00267F' }}
          >
            Email us →
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-4">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs">
          <a href="/search" className="hover:text-gray-600 transition-colors">Browse freelancers</a>
          <a href="/signup" className="hover:text-gray-600 transition-colors">List your services</a>
          <a href="/about" className="hover:text-gray-600 transition-colors">About</a>
          <a href="/faq" className="hover:text-gray-600 transition-colors">FAQ</a>
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </div>
      </footer>

    </main>
  )
}
