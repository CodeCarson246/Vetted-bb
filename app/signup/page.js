'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const trustPoints = [
  'Verified freelancers you can trust',
  'Two-way reviews for accountability',
  'Built for Barbados',
]

export default function SignUp() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const param = searchParams.get('role')
    if (param === 'freelancer' || param === 'client') {
      setRole(param)
    }
  }, [searchParams])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })

    if (error) {
      setError(error.message)
    } else if (data.session) {
      router.push(role === 'freelancer' ? '/dashboard?welcome=true' : '/dashboard')
    } else {
      setSuccess(true)
    }
    setLoading(false)
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
          <a href="/" className="md:hidden text-2xl font-bold mb-6 hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</a>
          <div className="md:hidden flex flex-col gap-2 mb-8 w-full max-w-md">
            {trustPoints.map(point => (
              <div key={point} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
                  <svg className="w-3 h-3" fill="none" stroke="#00267F" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">{point}</p>
              </div>
            ))}
          </div>

          <div className="w-full max-w-md">
            {success ? (
              <div className="text-center">
                <p className="text-4xl mb-4">📬</p>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
                <p className="text-gray-500 text-sm">We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>. Click it to activate your account.</p>
                <a href="/login" className="inline-block mt-8 text-sm font-semibold hover:opacity-75 transition-opacity" style={{ color: '#00267F' }}>Back to log in →</a>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
                <p className="text-gray-500 text-sm mb-8">Join Vetted.bb and connect with top talent in Barbados.</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                    />
                  </div>

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
                      placeholder="At least 6 characters"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">I am signing up as a...</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('client')}
                        className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${role === 'client' ? 'text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
                        style={role === 'client' ? { backgroundColor: '#00267F', borderColor: '#00267F' } : {}}
                      >
                        Client
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('freelancer')}
                        className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${role === 'freelancer' ? 'text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
                        style={role === 'freelancer' ? { backgroundColor: '#00267F', borderColor: '#00267F' } : {}}
                      >
                        Freelancer
                      </button>
                    </div>
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
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>

                  <p className="text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <a href="/login" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: '#00267F' }}>Log in</a>
                  </p>
                </form>
              </>
            )}
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
