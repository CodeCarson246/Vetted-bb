'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Lands here after Google redirects back. supabase-js picks the session out
// of the URL automatically; this page just waits for it, makes sure the user
// has a role in metadata (from the signup page's stashed choice, or a picker
// for first-time Google users who arrived via the login page), then routes
// to the right home. Existing users with a role skip straight through.
export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('working') // working | pick-role | error
  const finishing = useRef(false)

  const finish = useCallback(async (user, role) => {
    if (finishing.current) return
    finishing.current = true
    try { localStorage.removeItem('vetted_oauth_role') } catch { /* ignore */ }

    if (!user.user_metadata?.role) {
      await supabase.auth.updateUser({ data: { role } })
    }

    if (role === 'freelancer') {
      const { data: fp } = await supabase.from('freelancers').select('id').eq('user_id', user.id).maybeSingle()
      try { localStorage.setItem('vetted_is_freelancer', fp ? '1' : '0') } catch { /* ignore */ }
      router.replace(fp ? '/dashboard' : '/dashboard?welcome=true')
    } else {
      router.replace('/dashboard')
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    async function handleUser(user) {
      if (cancelled || finishing.current) return
      const existingRole = user.user_metadata?.role
      let stashed = null
      try { stashed = localStorage.getItem('vetted_oauth_role') } catch { /* ignore */ }

      if (existingRole === 'client' || existingRole === 'freelancer') {
        finish(user, existingRole)
      } else if (stashed === 'client' || stashed === 'freelancer') {
        finish(user, stashed)
      } else {
        // First Google sign-in via the login page — we don't know their role
        setStatus('pick-role')
      }
    }

    // The session may already be there, or arrive a moment later once
    // supabase-js finishes exchanging the tokens from the URL.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) handleUser(data.session.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) handleUser(session.user)
    })

    const timer = setTimeout(() => {
      if (!cancelled && !finishing.current) {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) handleUser(data.session.user)
          else setStatus('error')
        })
      }
    }, 8000)

    return () => { cancelled = true; sub.subscription.unsubscribe(); clearTimeout(timer) }
  }, [finish])

  async function pickRole(role) {
    setStatus('working')
    const { data } = await supabase.auth.getUser()
    if (data.user) finish(data.user, role)
    else setStatus('error')
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      {status === 'working' && (
        <div className="text-center">
          <p className="text-3xl mb-3" aria-hidden="true">🔐</p>
          <p className="text-sm text-gray-500">Signing you in…</p>
        </div>
      )}

      {status === 'pick-role' && (
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Almost there!</h1>
          <p className="text-sm text-gray-500 mb-8">Tell us how you&apos;ll be using Vetted.bb.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => pickRole('client')}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white p-5 text-left hover:border-gray-400 transition-colors"
            >
              <span className="block text-2xl mb-2" aria-hidden="true">🔍</span>
              <span className="block font-bold text-gray-900">I&apos;m a client</span>
              <span className="block text-xs text-gray-500 mt-1">I want to find and hire trusted professionals.</span>
            </button>
            <button
              onClick={() => pickRole('freelancer')}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white p-5 text-left hover:border-gray-400 transition-colors"
            >
              <span className="block text-2xl mb-2" aria-hidden="true">🛠️</span>
              <span className="block font-bold text-gray-900">I&apos;m a freelancer</span>
              <span className="block text-xs text-gray-500 mt-1">I want to offer my services and get hired.</span>
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center max-w-sm">
          <p className="text-3xl mb-3" aria-hidden="true">😕</p>
          <h1 className="text-lg font-bold text-gray-900 mb-1">Sign-in didn&apos;t complete</h1>
          <p className="text-sm text-gray-500 mb-5">Something interrupted the Google sign-in. Please try again.</p>
          <a href="/login" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
            Back to log in
          </a>
        </div>
      )}
    </main>
  )
}
