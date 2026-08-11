'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const trustPoints = [
  'Verified freelancers you can trust',
  'Two-way reviews for accountability',
  'Built for Barbados',
]

// stage: 'checking' | 'ready' | 'expired' | 'success'
export default function ResetPassword() {
  const router = useRouter()
  const [stage, setStage] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Work out whether we arrived with a valid recovery session.
  // Supabase (detectSessionInUrl) exchanges the recovery token for a session
  // and fires onAuthStateChange. An expired/used link instead comes back with
  // error params in the hash or query — treat that as expired.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const search = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search
    const params = new URLSearchParams(hash || search)
    if (params.get('error') || params.get('error_code') || params.get('error_description')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount check
      setStage('expired')
      return
    }

    let settled = false
    const ready = () => { if (!settled) { settled = true; setStage('ready') } }

    supabase.auth.getSession().then(({ data }) => { if (data.session) ready() })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { if (session) ready() })

    // No session and no error after a moment → the link is stale/invalid.
    const timer = setTimeout(() => { if (!settled) { settled = true; setStage('expired') } }, 4000)

    return () => { sub.subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      // A missing/expired recovery session surfaces here too.
      if (/session|expired|token|jwt/i.test(error.message)) { setStage('expired'); return }
      setError(error.message)
      return
    }
    setStage('success')
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <main className="min-h-screen flex">
      {/* Left panel — desktop only (matches the login page) */}
      <div className="hidden md:flex md:w-2/5 flex-col" style={{ backgroundColor: '#00267F' }}>
        <div className="flex-1 flex flex-col px-12" style={{ paddingTop: '28%' }}>
          <Link
            href="/"
            className="hover:opacity-90 transition-opacity"
            style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'var(--surface-card)', borderRadius: '999px', padding: '10px 28px', fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '1.5rem', textDecoration: 'none', lineHeight: 1 }}
          >
            <span style={{ color: '#00267F' }}>Vetted</span>
            <span style={{ color: '#F9C000' }}>.</span>
            <span style={{ color: '#00267F' }}>bb</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 400, marginTop: '10px', marginBottom: '4rem' }}>Connecting Barbados</p>
          <div className="flex flex-col gap-7">
            {trustPoints.map(point => (
              <div key={point} className="flex items-center gap-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.88)' }}>{point}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: '#F9C000' }} />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          <Link href="/" className="md:hidden text-2xl font-bold mb-8 hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</Link>

          <div className="w-full max-w-md">

            {stage === 'checking' && (
              <div className="text-center py-8">
                <svg className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-gray-400">Checking your link…</p>
              </div>
            )}

            {stage === 'expired' && (
              <div className="text-center">
                <p className="text-4xl mb-3" aria-hidden="true">⏳</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">This reset link has expired</h1>
                <p className="text-gray-500 text-sm mb-8">Password reset links can only be used once and expire after a short time. Request a new one and we&apos;ll email you a fresh link.</p>
                <Link href="/login" className="inline-block w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
                  Request a new link
                </Link>
              </div>
            )}

            {stage === 'success' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 mx-auto" style={{ backgroundColor: '#00267F' }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h1>
                <p className="text-gray-500 text-sm">Taking you to the login page…</p>
              </div>
            )}

            {stage === 'ready' && (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Set a new password</h1>
                <p className="text-gray-500 text-sm mb-8">Choose a new password for your Vetted.bb account.</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                    <div className="relative">
                      <input
                        type={show ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(null) }}
                        placeholder="At least 8 characters"
                        className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                      />
                      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {show ? (
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.24A9.1 9.1 0 0112 4c7 0 10 8 10 8a13.2 13.2 0 01-1.67 2.68M6.1 6.1A13.3 13.3 0 002 12s3 8 10 8a9.1 9.1 0 004.05-.94" /></svg>
                        ) : (
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                    <input
                      type={show ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError(null) }}
                      placeholder="Repeat your new password"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    {loading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <footer className="px-8 py-6 text-center text-gray-400 text-xs border-t border-gray-100">
          <p>© 2026 Vetted.bb · Connecting Barbados</p>
          <p className="mt-1">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          </p>
        </footer>
      </div>
    </main>
  )
}
