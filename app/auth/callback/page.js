'use client'
import Link from 'next/link'
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
  const [errorMsg, setErrorMsg] = useState('Something interrupted the sign-in. Please try again.')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const finishing = useRef(false)

  const finish = useCallback(async (user, role) => {
    if (finishing.current) return
    finishing.current = true
    try { localStorage.removeItem('vetted_oauth_role') } catch { /* ignore */ }

    // First time we set a role = the account is being established, so record
    // Terms acceptance now too (they agreed on the signup page, or on the
    // pick-role screen below). Existing users keep their original stamp.
    if (!user.user_metadata?.role) {
      const patch = { role }
      if (!user.user_metadata?.terms_accepted_at) patch.terms_accepted_at = new Date().toISOString()
      await supabase.auth.updateUser({ data: patch })
    }

    if (role === 'freelancer') {
      const { data: fp } = await supabase.from('freelancers').select('id').eq('user_id', user.id).maybeSingle()
      try { localStorage.setItem('vetted_is_freelancer', fp ? '1' : '0') } catch { /* ignore */ }
      router.replace(fp ? '/dashboard' : '/dashboard?welcome=true')
    } else {
      // Clients land on the marketplace.
      router.replace('/search')
    }
  }, [router])

  useEffect(() => {
    let cancelled = false

    // Expired / already-used links (email confirm, recovery, OAuth denial)
    // come back with error params in the hash or query. Catch them up front
    // and show a friendly message instead of waiting on a session that will
    // never arrive.
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
      const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search
      const p = new URLSearchParams(hash || search)
      const errCode = p.get('error_code') || p.get('error')
      if (errCode) {
        const desc = p.get('error_description')
        const friendly = /expired|otp_expired/i.test(errCode + (desc || ''))
          ? 'This link has expired or was already used. Please request a new one.'
          : (desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'This link could not be verified. Please try again.')
        /* eslint-disable react-hooks/set-state-in-effect -- one-time mount check */
        setErrorMsg(friendly)
        setStatus('error')
        /* eslint-enable react-hooks/set-state-in-effect */
        return () => {}
      }
    }

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
          else {
            setErrorMsg('We couldn’t complete that link. It may have expired or already been used — please try again.')
            setStatus('error')
          }
        })
      }
    }, 8000)

    return () => { cancelled = true; sub.subscription.unsubscribe(); clearTimeout(timer) }
  }, [finish])

  async function pickRole(role) {
    if (!agreedToTerms) return
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
          <p className="text-sm text-gray-500 mb-6">Tell us how you&apos;ll be using Vetted.bb.</p>

          {/* Google users who signed in from the login page haven't accepted
              the terms yet — gate the role choice on it. */}
          <label className="flex items-start gap-2.5 mb-5 text-left cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm text-gray-600 leading-snug">
              I agree to Vetted.bb&apos;s{' '}
              <Link href="/terms" target="_blank" className="font-semibold underline" style={{ color: '#00267F' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" className="font-semibold underline" style={{ color: '#00267F' }}>Privacy Policy</Link>.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => pickRole('client')}
              disabled={!agreedToTerms}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white p-5 text-left hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200"
            >
              <span className="block text-2xl mb-2" aria-hidden="true">🔍</span>
              <span className="block font-bold text-gray-900">I&apos;m a client</span>
              <span className="block text-xs text-gray-500 mt-1">I want to find and hire trusted professionals.</span>
            </button>
            <button
              onClick={() => pickRole('freelancer')}
              disabled={!agreedToTerms}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white p-5 text-left hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200"
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
          <h1 className="text-lg font-bold text-gray-900 mb-1">We couldn&apos;t complete that</h1>
          <p className="text-sm text-gray-500 mb-5">{errorMsg}</p>
          <Link href="/login" className="inline-block text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
            Back to log in
          </Link>
        </div>
      )}
    </main>
  )
}
