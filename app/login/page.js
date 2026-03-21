'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const trustPoints = [
  'Verified freelancers you can trust',
  'Two-way reviews for accountability',
  'Built for Barbados',
]

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/search')
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetLoading(true)
    setResetError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://vetted-bb.vercel.app/reset-password',
    })

    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  return (
    <main className="min-h-screen flex">

      {/* Left panel — desktop only */}
      <div className="hidden md:flex md:w-2/5 flex-col" style={{ backgroundColor: '#00267F' }}>
        <div className="flex-1 flex flex-col justify-center px-12 py-16">
          {/* Logo */}
          <a href="/" className="text-3xl font-bold text-white mb-1 hover:opacity-90 transition-opacity">Vetted.bb</a>
          <p className="text-sm font-medium mb-16" style={{ color: '#93b8ff' }}>Connecting Barbados</p>

          {/* Trust bullets */}
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

        {/* Yellow accent stripe */}
        <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: '#F9C000' }} />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">

          {/* Mobile logo */}
          <a href="/" className="md:hidden text-2xl font-bold mb-10 hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</a>

          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm mb-8">Log in to your Vetted.bb account.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => { setShowForgot(v => !v); setResetSent(false); setResetError(null) }}
                  className="mt-2 text-xs font-medium hover:opacity-75 transition-opacity"
                  style={{ color: '#00267F' }}
                >
                  Forgot your password?
                </button>
              </div>

              {showForgot && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 flex flex-col gap-3">
                  {resetSent ? (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                      Check your email for a reset link.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Enter your email and we'll send you a reset link.</p>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none focus:border-gray-800 bg-white transition-colors"
                      />
                      {resetError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</p>
                      )}
                      <button
                        type="button"
                        disabled={resetLoading}
                        onClick={handleReset}
                        className="w-full text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#00267F' }}
                      >
                        {resetLoading ? 'Sending...' : 'Send reset link'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#00267F' }}
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <a href="/signup" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: '#00267F' }}>Sign up</a>
              </p>
            </form>
          </div>
        </div>

        <footer className="px-8 py-6 text-center text-gray-400 text-xs border-t border-gray-100">
          <p>© 2026 Vetted.bb · Connecting Barbados</p>
          <p className="mt-1">
            <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
            <span className="mx-2">·</span>
            <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
          </p>
        </footer>
      </div>

    </main>
  )
}
