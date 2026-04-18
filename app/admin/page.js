'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const ADMIN_EMAIL = 'redman.lampard@outlook.com'

export default function AdminPanel() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Stats
  const [freelancerCount, setFreelancerCount] = useState(0)
  const [clientCount, setClientCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  // Data
  const [freelancers, setFreelancers] = useState([])
  const [reviews, setReviews] = useState([])
  const [messages, setMessages] = useState([])

  // UI
  const [activeSection, setActiveSection] = useState('stats')
  const [deletingId, setDeletingId] = useState(null)

  const { user: authUser, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (!authUser || authUser.email !== ADMIN_EMAIL) {
      router.replace('/')
      return
    }
    setUser(authUser)

    async function fetchData() {
      const [
        { count: fCount },
        { count: cCount },
        { count: rCount },
        { count: mCount },
        { data: fData },
        { data: rData },
        { data: mData },
      ] = await Promise.all([
        supabase.from('freelancers').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('freelancers').select('id, name, trade, category, location, rating, created_at').order('created_at', { ascending: false }),
        supabase.from('reviews').select('id, author, comment, rating, type, date, created_at').order('created_at', { ascending: false }),
        supabase.from('messages').select('id, sender_name, sender_email, subject, created_at, read').order('created_at', { ascending: false }),
      ])

      setFreelancerCount(fCount || 0)
      setClientCount(cCount || 0)
      setReviewCount(rCount || 0)
      setMessageCount(mCount || 0)
      setFreelancers(fData || [])
      setReviews(rData || [])
      setMessages(mData || [])
      setLoading(false)
    }
    fetchData()
  }, [authUser, authLoading, router])

  async function deleteFreelancer(id) {
    if (!confirm('Delete this freelancer and all their data? This cannot be undone.')) return
    setDeletingId(id)
    await Promise.all([
      supabase.from('services').delete().eq('freelancer_id', id),
      supabase.from('reviews').delete().eq('freelancer_id', id),
      supabase.from('messages').delete().eq('freelancer_id', id),
    ])
    await supabase.from('freelancers').delete().eq('id', id)
    setFreelancers(prev => prev.filter(f => f.id !== id))
    setFreelancerCount(prev => prev - 1)
    setDeletingId(null)
  }

  async function deleteReview(id) {
    if (!confirm('Delete this review?')) return
    setDeletingId(id)
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(prev => prev.filter(r => r.id !== id))
    setReviewCount(prev => prev - 1)
    setDeletingId(null)
  }

  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return
    setDeletingId(id)
    await supabase.from('messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
    setMessageCount(prev => prev - 1)
    setDeletingId(null)
  }

  function formatDate(str) {
    if (!str) return '—'
    return new Date(str).toLocaleDateString('en-BB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-8 py-5">
            <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          </div>
        </nav>
        <div className="flex items-center justify-center py-32">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </main>
    )
  }

  const sections = [
    { key: 'stats', label: 'Stats' },
    { key: 'freelancers', label: `Freelancers (${freelancerCount})` },
    { key: 'reviews', label: `Reviews (${reviewCount})` },
    { key: 'messages', label: `Messages (${messageCount})` },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: '#00267F' }}>Admin</span>
          </div>
          <div className="hidden sm:flex gap-4 items-center">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#00267F' }}
            >
              Log out
            </button>
          </div>
          <button className="sm:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-left text-red-500 font-medium">Log out</button>
          </div>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the Vetted.bb platform</p>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${activeSection === s.key ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
              style={activeSection === s.key ? { backgroundColor: '#00267F' } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Stats ── */}
        {activeSection === 'stats' && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total users', value: 'View in Supabase', note: true },
              { label: 'Freelancers', value: freelancerCount },
              { label: 'Clients', value: clientCount },
              { label: 'Reviews', value: reviewCount },
              { label: 'Messages', value: messageCount },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-6 text-center" style={{ borderTop: '3px solid #00267F' }}>
                <p className={`font-bold text-gray-900 mb-1 ${stat.note ? 'text-sm mt-2' : 'text-3xl'}`}>{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Freelancers ── */}
        {activeSection === 'freelancers' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900" style={{ color: '#00267F' }}>Freelancers ({freelancerCount})</h2>
              <div className="mt-3 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed" style={{ backgroundColor: '#FEF9EC', border: '1px solid #F9C000' }}>
                <p className="font-semibold mb-1">⚠ Verification checklist: before approving the verified badge:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  <li>Visit the public profile and review all portfolio/service images</li>
                  <li>Images should be genuine photos of real work, not stock photos, placeholders, or unrelated content</li>
                  <li>Reject or request replacement of any images that look generic, AI-generated, or irrelevant to the listed trade</li>
                  <li>Check that service descriptions match the portfolio images shown</li>
                </ul>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trade</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {freelancers.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No freelancers found.</td></tr>
                  )}
                  {freelancers.map((f, i) => (
                    <tr key={f.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 font-medium text-gray-900 capitalize">{f.name}</td>
                      <td className="px-6 py-4 text-gray-600 capitalize">{f.trade || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{f.category || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{f.rating ?? '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(f.created_at)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteFreelancer(f.id)}
                          disabled={deletingId === f.id}
                          className="text-xs font-medium text-white px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === f.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Reviews ── */}
        {activeSection === 'reviews' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold" style={{ color: '#00267F' }}>Reviews ({reviewCount})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Author</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comment</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No reviews found.</td></tr>
                  )}
                  {reviews.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 font-medium text-gray-900">{r.author || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs">
                        <span title={r.comment}>{r.comment ? r.comment.slice(0, 60) + (r.comment.length > 60 ? '…' : '') : '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{r.rating ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.type === 'client' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                          {r.type || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(r.created_at || r.date)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteReview(r.id)}
                          disabled={deletingId === r.id}
                          className="text-xs font-medium text-white px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        {activeSection === 'messages' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold" style={{ color: '#00267F' }}>Messages ({messageCount})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sender</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No messages found.</td></tr>
                  )}
                  {messages.map((m, i) => (
                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 font-medium text-gray-900">{m.sender_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{m.sender_email || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs">
                        <span title={m.subject}>{m.subject ? m.subject.slice(0, 60) + (m.subject.length > 60 ? '…' : '') : '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(m.created_at)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${m.read ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>
                          {m.read ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteMessage(m.id)}
                          disabled={deletingId === m.id}
                          className="text-xs font-medium text-white px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === m.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
