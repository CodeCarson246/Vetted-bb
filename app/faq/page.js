'use client'
import { useState } from 'react'

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
  return (
    <main className="min-h-screen bg-gray-50">

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

    </main>
  )
}
