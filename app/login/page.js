'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-100">
        <a href="/" className="text-2xl font-bold" style={{ color: '#00267F' }}>Vetted.bb</a>
        <div className="flex gap-4">
          <a href="/login" className="text-gray-600 hover:text-gray-900 font-medium">Log in</a>
          <a href="/signup" className="text-white px-5 py-2 rounded-full font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>Sign up</a>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-8 py-16">
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Log in to your Vetted.bb account.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-gray-400 bg-white"
              />
              <button
                type="button"
                onClick={() => { setShowForgot(v => !v); setResetSent(false); setResetError(null) }}
                className="mt-2 text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ color: '#00267F' }}
              >
                Forgot your password?
              </button>
            </div>

            {showForgot && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm outline-none focus:border-gray-400 bg-white"
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: '#00267F' }}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <a href="/signup" className="font-medium hover:underline" style={{ color: '#00267F' }}>Sign up</a>
            </p>
          </form>
        </div>
      </div>

      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm mt-12">
        © 2026 Vetted.bb · Connecting Barbados
      </footer>
    </main>
  )
}
