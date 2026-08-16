'use client'
import { useState } from 'react'
import Link from 'next/link'

// Freelancer workspace guide — plain-language walkthroughs of every part of
// the platform. Static content, searchable, grouped by area. Anyone can open
// it (clients get the top nav), but the topics are written for freelancers.

const SECTIONS = [
  {
    id: 'messages',
    icon: '💬',
    title: 'Messages & inbox',
    intro: 'Every job starts as a conversation. The inbox is where enquiries land and deals get made.',
    topics: [
      {
        title: 'How enquiries reach you',
        steps: [
          'When a client finds your profile and hits "Message" or "Request a Quote", a new conversation appears in your Inbox (sidebar → Inbox).',
          'The red badge on Inbox shows how many conversations have unread messages. You\'ll also get a notification, plus a push alert on your phone if you\'ve turned those on in Settings.',
          'Open a conversation to see the full thread: the client\'s details sit in the right-hand panel, so you always know who you\'re talking to.',
        ],
        tip: 'Reply quickly. Your profile shows a public "Typically replies within…" badge based on your real response times, and fast replies win jobs.',
      },
      {
        title: 'Sending photos in chat',
        steps: [
          'Use the 📷 button next to the reply box to attach a photo, handy for "here\'s the problem" shots from clients or progress photos from you.',
          'Photos are compressed automatically, so they send fast even on mobile data.',
        ],
      },
      {
        title: 'Cleaning up your inbox',
        steps: [
          'Tap "Select" at the top of your conversation list to enter selection mode.',
          'Tick the conversations you want gone, then hit Delete. This clears them from your side.',
        ],
      },
    ],
  },
  {
    id: 'quotes',
    icon: '📄',
    title: 'Quotes, invoices & getting paid',
    intro: 'The quote flow takes a job from "how much?" to paid, with a record of every step.',
    topics: [
      {
        title: 'Sending a quote',
        steps: [
          'Open the conversation in your Inbox and hit "Send a quote". The quote builder lets you add line items, set payment terms, and add notes.',
          'Send it in-app (the client sees it right in the chat and gets notified), or email it / download a PDF if they prefer.',
          'The client can Accept or Decline from their side. You\'re notified the moment they respond.',
        ],
        tip: 'Quotes with clear line items get accepted more often than a single lump sum. Clients like seeing what they\'re paying for.',
      },
      {
        title: 'From accepted quote to paid job',
        steps: [
          'Do the work. When you\'re done, open the quote and hit "Mark completed". The client confirms completion from their side too, so both of you agree the job is done.',
          'Send an invoice from the quote (it gets an invoice number, terms and a due date automatically).',
          'When the money arrives, hit "Mark paid". You can then send the client a receipt with one tap.',
        ],
        tip: 'Reviews unlock only after the job is mutually completed AND marked paid, so closing out jobs properly is how you build your rating.',
      },
      {
        title: 'Reading the earnings tab',
        steps: [
          'Sidebar → Quotes & earnings, then open the Earnings tab.',
          'Everything there is real money. Only quotes you\'ve marked paid are counted. No estimates, no projections.',
          'Switch the chart between the last 30 days and the last 12 months to spot trends, and use "Export CSV" to download your records for bookkeeping or taxes.',
        ],
      },
    ],
  },
  {
    id: 'bookings',
    icon: '📅',
    title: 'Bookings & calendar',
    intro: 'Your calendar is private by default. Bookings are opt-in, so turn them on only if your work suits scheduled appointments.',
    topics: [
      {
        title: 'Turning on booking requests',
        steps: [
          'Go to Settings → Bookings and flip on "Accept booking requests". It\'s off by default, so quote-only trades can ignore it entirely.',
          'Choose how clients book: "Request a day" (they pick a date, you agree the time in chat) or "Exact time slots" (they pick an open slot from your working hours).',
          'Tick which of your services are bookable and set a duration for each. Only ticked services show a booking button on your public profile.',
          'Set your lead time, which controls how soon someone can book (same day, from tomorrow, etc.).',
        ],
        tip: 'Slot mode suits session-based work (coaching, beauty, lessons). Day mode suits trades where the time depends on the job.',
      },
      {
        title: 'Handling booking requests',
        steps: [
          'New requests land on your Calendar as pending, and you get a notification.',
          'Open the request and Confirm or Decline. The client is notified either way, and can see the status (or cancel a pending request) from their "My bookings" page.',
        ],
      },
      {
        title: 'Your private schedule vs public availability',
        steps: [
          'Everything you add to your Calendar (jobs, personal bookings) is private. Clients never see it, and it never blocks your public availability.',
          'The one exception is "Time off": blocking out days (vacation, personal time, no reason needed) is what removes those dates from public booking.',
          'This is deliberate: many pros run several jobs at once, so a booked job shouldn\'t automatically close your books.',
        ],
      },
    ],
  },
  {
    id: 'clients',
    icon: '👥',
    title: 'Clients',
    intro: 'A lightweight client book, built automatically from your activity, with no data entry.',
    topics: [
      {
        title: 'Where the client list comes from',
        steps: [
          'Sidebar → Clients. Every person who has messaged you, accepted a quote, or booked you appears here automatically, grouped by their email.',
          'Each row shows their history with you: conversations, quotes, jobs and bookings, plus totals.',
          'Use the search box and tabs to find repeat clients or check what you last did for someone before they call back.',
        ],
        tip: 'Before replying to a returning client, glance at their card. Quoting consistently with what you charged them last time builds trust.',
      },
    ],
  },
  {
    id: 'reviews',
    icon: '⭐',
    title: 'Reviews & reputation',
    intro: 'Reviews are two-way on Vetted.bb: clients rate you, and you rate clients.',
    topics: [
      {
        title: 'Getting reviews',
        steps: [
          'A client can review you once a job is mutually completed and paid, so finish the quote flow properly (see Quotes above).',
          'You can also rate the client, which helps other pros know who\'s good to work with.',
        ],
      },
      {
        title: 'Responding to reviews',
        steps: [
          'Sidebar → Reviews shows your average, your response rate, and every review.',
          'Reply publicly to any review. A short, professional response (especially to a critical one) is often more convincing to future clients than the review itself.',
        ],
        tip: 'Aim to respond to every review. Your response rate is shown as part of your reputation.',
      },
    ],
  },
  {
    id: 'account',
    icon: '⚙️',
    title: 'Notifications, visibility & account',
    intro: 'Control how you\'re alerted, how visible you are, and your account itself.',
    topics: [
      {
        title: 'Push notifications',
        steps: [
          'Settings → Notifications → turn on push. You\'ll get lock-screen alerts for new messages, quote responses and booking requests, even with the app closed.',
          'If the button says "Blocked in browser", you previously denied permission. Re-enable notifications for the site in your phone\'s browser settings.',
        ],
        tip: 'If you\'ve added Vetted.bb to your home screen, enable push from inside that app for the most reliable alerts.',
      },
      {
        title: 'Hiding your profile temporarily',
        steps: [
          'Settings → Profile visibility → flip the switch. You disappear from search and categories, and your profile page shows as unavailable.',
          'Existing conversations, quotes and bookings keep working. This only stops new discovery, and you can flip it back any time, instantly.',
        ],
        tip: 'Fully booked for a month? Hide your profile instead of ignoring enquiries. Unanswered messages hurt your response-time badge.',
      },
      {
        title: 'Running more than one business',
        steps: [
          'You don\'t need a second account. On each service, fill in "Which business is this for?" (Dashboard > your services) and name the venture, for example "Joe\'s Landscaping".',
          'Your public profile then shows a tab per business, so clients can switch between them instead of scrolling one long mixed list.',
          'In Edit profile, use "Also appears in" to pick up to 2 extra categories. You\'ll then show up when clients browse those categories too, not just your main one.',
        ],
        tip: 'Keep the venture name identical across services (the box suggests names you\'ve already used) so they group under one tab instead of splitting into several.',
      },
      {
        title: 'The verified badge',
        steps: [
          'The ✓ Vetted badge is granted after our team verifies your identity and work. Head to your dashboard and follow the "Get verified" steps. It typically involves confirming your phone number.',
          'Verified profiles stand out in search results and win more client trust.',
        ],
      },
      {
        title: 'Deactivating your account',
        steps: [
          'Settings → Deactivate account (at the bottom). Your account comes down immediately, and you have 60 days to change your mind. Just log back in and hit Reactivate.',
          'After 60 days, everything is permanently deleted. If you just need a break, use "Hide profile" instead. It\'s instant and nothing is lost.',
        ],
      },
    ],
  },
]

function Chevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function GuidePage() {
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState(null)

  const q = query.trim().toLowerCase()
  const matches = topic =>
    !q ||
    topic.title.toLowerCase().includes(q) ||
    topic.steps.some(s => s.toLowerCase().includes(q)) ||
    (topic.tip || '').toLowerCase().includes(q)

  const visibleSections = SECTIONS
    .map(s => ({ ...s, topics: s.topics.filter(matches) }))
    .filter(s => s.topics.length > 0)

  return (
    <main className="min-h-screen page-bg">
      {/* Hero */}
      <div style={{ backgroundColor: '#00267F' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 text-center">
          <p className="text-3xl mb-2" aria-hidden="true">📖</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">How Vetted.bb works</h1>
          <p className="text-sm mb-6" style={{ color: '#93b8ff' }}>
            Short, practical walkthroughs of every part of your workspace, from first enquiry to getting paid.
          </p>
          <div className="max-w-md mx-auto relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search the guide, e.g. bookings, invoice, push…"
              className="w-full pl-10 pr-4 py-3 rounded-full text-sm outline-none"
              style={{ backgroundColor: '#fff', color: '#111827', border: '2px solid transparent' }}
              onFocus={e => (e.target.style.borderColor = '#F9C000')}
              onBlur={e => (e.target.style.borderColor = 'transparent')}
            />
          </div>
        </div>
        <div style={{ display: 'flex', height: 4 }} aria-hidden="true">
          <div style={{ flex: 1, backgroundColor: '#001652' }} />
          <div style={{ flex: 1, backgroundColor: '#F9C000' }} />
          <div style={{ flex: 1, backgroundColor: '#001652' }} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        {/* Section quick links */}
        {!q && (
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors hover:border-gray-400"
                style={{ borderColor: 'var(--border-card)', color: 'var(--accent)', textDecoration: 'none', backgroundColor: 'var(--surface-card)' }}
              >
                {s.icon} {s.title}
              </a>
            ))}
          </div>
        )}

        {visibleSections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3" aria-hidden="true">🔍</p>
            <p className="font-semibold text-gray-900 mb-1">Nothing found for &quot;{query}&quot;</p>
            <p className="text-sm text-gray-500">Try a different word, or message us at hello@vetted.bb and we&apos;ll point you the right way.</p>
          </div>
        )}

        {visibleSections.map(section => (
          <section key={section.id} id={section.id} className="mb-8" style={{ scrollMarginTop: 90 }}>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-xl" aria-hidden="true">{section.icon}</span>
              <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">{section.intro}</p>

            <div className="flex flex-col gap-2.5">
              {section.topics.map(topic => {
                const key = `${section.id}:${topic.title}`
                const open = openKey === key || (!!q && section.topics.length <= 2)
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ borderLeft: '3px solid #F9C000' }}>
                    <button
                      onClick={() => setOpenKey(openKey === key ? null : key)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      aria-expanded={open}
                    >
                      <span className="text-sm font-semibold text-gray-900">{topic.title}</span>
                      <span className="text-gray-400"><Chevron open={open} /></span>
                    </button>
                    {open && (
                      <div className="px-5 pb-5">
                        <ol className="flex flex-col gap-2.5">
                          {topic.steps.map((step, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5" style={{ backgroundColor: '#00267F' }}>
                                {i + 1}
                              </span>
                              <span className="text-sm text-gray-600 leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ol>
                        {topic.tip && (
                          <p className="text-xs mt-4 rounded-xl px-4 py-3 leading-relaxed" style={{ backgroundColor: '#FEF9EC', border: '1px solid #F9C000', color: '#92400e' }}>
                            💡 <strong>Tip:</strong> {topic.tip}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* Footer CTA */}
        <div className="rounded-2xl px-6 py-8 text-center mt-10" style={{ backgroundColor: '#00267F' }}>
          <p className="font-bold text-white mb-1">Still stuck on something?</p>
          <p className="text-sm mb-4" style={{ color: '#93b8ff' }}>We read every message. Tell us what&apos;s confusing and we&apos;ll fix it or add it to this guide.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <a href="mailto:hello@vetted.bb" className="text-sm font-semibold px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#F9C000', color: '#00267F', textDecoration: 'none' }}>
              Email us
            </a>
            <Link href="/roadmap" className="text-sm font-semibold px-5 py-2.5 rounded-full border-2 text-white hover:bg-white/10 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              Suggest a feature
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
