'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function EnvelopeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

export default function Inbox() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const unreadCount = messages.filter(m => !m.read).length

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: p } = await supabase
        .from('freelancers')
        .select('id, name, avatar_url')
        .eq('user_id', user.id)
        .single()

      if (p) {
        setProfile(p)
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('freelancer_id', p.id)
          .order('created_at', { ascending: false })
        setMessages(msgs || [])
      }

      setLoading(false)
    }
    init()
  }, [router])

  async function handleExpand(msg) {
    if (expandedId === msg.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(msg.id)
    if (!msg.read) {
      await supabase.from('messages').update({ read: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="relative bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-5">
          <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
          <div className="hidden sm:flex gap-4 items-center">
            {profile ? (
              <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-gray-600 text-sm font-medium">{profile.name}</span>
              </a>
            ) : (
              <span className="text-gray-600 text-sm font-medium">{user?.email}</span>
            )}
            {profile && (
              <a href="/inbox" className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                <EnvelopeIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>
            )}
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
            {profile ? (
              <a href="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ backgroundColor: '#00267F' }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-gray-600 text-sm font-medium">{profile.name}</span>
              </a>
            ) : (
              <span className="text-gray-600 text-sm font-medium">{user?.email}</span>
            )}
            {profile && (
              <a href="/inbox" className="flex items-center gap-2 text-gray-700 font-medium">
                Inbox
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </a>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="text-left text-red-500 font-medium"
            >
              Log out
            </button>
          </div>
        )}
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          {unreadCount > 0 && (
            <span className="text-sm text-gray-500">{unreadCount} unread</span>
          )}
        </div>

        {!profile ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
            <p className="text-gray-500 text-sm">You need a freelancer profile to receive messages.</p>
            <a href="/dashboard" className="mt-4 inline-block text-sm font-medium hover:opacity-80" style={{ color: '#00267F' }}>Create a profile →</a>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <EnvelopeIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-1">No messages yet</p>
            <p className="text-sm text-gray-500">Messages from potential clients will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => handleExpand(msg)}
                className={`bg-white rounded-2xl border transition-all cursor-pointer ${expandedId === msg.id ? 'border-gray-200 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                      {msg.sender_name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${!msg.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                            {msg.sender_name}
                          </span>
                          {!msg.read && (
                            <span className="text-xs text-white px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#00267F' }}>
                              Unread
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mt-0.5">{msg.sender_email}</p>
                      <p className={`text-sm mt-1 ${!msg.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {msg.subject}
                      </p>

                      {expandedId !== msg.id && (
                        <p className="text-sm text-gray-500 mt-1">
                          {msg.message.length > 100 ? msg.message.slice(0, 100) + '…' : msg.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {expandedId === msg.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 ml-14">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      <a
                        href={`mailto:${msg.sender_email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                        onClick={e => e.stopPropagation()}
                        className="mt-4 inline-block text-sm font-medium hover:opacity-80 transition-opacity"
                        style={{ color: '#00267F' }}
                      >
                        Reply via email →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        <p>© 2026 Vetted.bb · Connecting Barbados</p>
        <p className="mt-1.5 text-xs">
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </p>
      </footer>
    </main>
  )
}
