'use client'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { passwordChecks, validatePassword, POLICY_KEYS, POLICY_LABELS } from '@/lib/passwordPolicy'
import GoogleAuthButton from '@/components/GoogleAuthButton'
import { ORG_KINDS, ensureOrganisation, readPendingInvite } from '@/lib/organisations'

const trustPoints = [
  'Verified freelancers you can trust',
  'Two-way reviews for accountability',
  'Built for Barbados',
]

// Freelancers see the pitch aimed at them once they pick that role.
const freelancerTrustPoints = [
  'Free to join, no commission on your jobs',
  'Run several businesses? List them all on one profile',
  'Build your reputation with verified reviews',
]

// Organisations get the pitch for a team that hires, not an individual.
const organisationTrustPoints = [
  'One account for your whole team, one record of every quote',
  'Search a pool of verified local professionals',
  'Professionals invoice you directly. No fees, no middleman',
]

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('client')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [organisationName, setOrganisationName] = useState('')
  const [organisationKind, setOrganisationKind] = useState('business')
  // Arrived via an organisation invite link: they are joining an existing
  // organisation, so we do not ask them to name a new one.
  const [invitePending] = useState(() => typeof window !== 'undefined' && !!readPendingInvite())

  useEffect(() => {
    const param = searchParams.get('role')
    if (param === 'freelancer' || param === 'client' || param === 'organisation') {
      setRole(param)
    }
  }, [searchParams])

  const points = role === 'freelancer' ? freelancerTrustPoints : role === 'organisation' ? organisationTrustPoints : trustPoints
  const checks = passwordChecks(password, { name: fullName, email })
  const pwValid = POLICY_KEYS.every(k => checks[k])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!agreedToTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }

    if (role === 'organisation' && !invitePending && organisationName.trim().length < 2) {
      setError('Please enter your organisation\u2019s name.')
      return
    }

    if (!validatePassword(password, { name: fullName, email }).valid) {
      setError('Please meet all the password requirements below.')
      return
    }

    setLoading(true)
    // Go through our server route so the password policy is enforced
    // server-side, not just here in the form.
    let result
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, role, agreedToTerms, organisationName: invitePending ? '' : organisationName, organisationKind }),
      })
      result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Could not create your account. Please try again.')
        setLoading(false)
        return
      }
    } catch {
      setError('Could not reach the server. Please try again.')
      setLoading(false)
      return
    }

    if (result.session) {
      // Auto-confirm projects: adopt the session in the browser, then go.
      await supabase.auth.setSession(result.session)
      if (role === 'organisation') {
        // Create the organisation now (name is in metadata); an invite is
        // redeemed on the organisation dashboard instead.
        const { data: { user: u } } = await supabase.auth.getUser()
        if (!invitePending) await ensureOrganisation(u)
        router.push('/organisation')
      } else {
        router.push(role === 'freelancer' ? '/dashboard?welcome=true' : '/dashboard')
      }
    } else {
      // Email confirmation required
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex">

      {/* Left panel — desktop only */}
      <div className="hidden md:flex md:w-2/5 flex-col" style={{ backgroundColor: '#00267F' }}>
        <div className="flex-1 flex flex-col px-12" style={{ paddingTop: '28%' }}>
          {/* Logo pill */}
          <Link
            href="/"
            className="hover:opacity-90 transition-opacity"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: 'var(--surface-card)',
              borderRadius: '999px',
              padding: '10px 28px',
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '1.5rem',
              textDecoration: 'none',
              lineHeight: 1,
            }}
          >
            <span style={{ color: '#00267F' }}>Vetted</span>
            <span style={{ color: '#F9C000' }}>.</span>
            <span style={{ color: '#00267F' }}>bb</span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 400, marginTop: '10px', marginBottom: '4rem' }}>Connecting Barbados</p>

          {/* Trust bullets */}
          <div className="flex flex-col gap-7">
            {points.map(point => (
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
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">

          {/* Mobile logo */}
          <Link href="/" className="md:hidden text-2xl font-bold mb-6 hover:opacity-80 transition-opacity" style={{ color: '#00267F' }}>Vetted.bb</Link>
          <div className="md:hidden flex flex-col gap-2 mb-8 w-full max-w-md">
            {points.map(point => (
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
                <Link href="/login" className="inline-block mt-8 text-sm font-semibold hover:opacity-75 transition-opacity" style={{ color: '#00267F' }}>Back to log in →</Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
                <p className="text-gray-500 text-sm mb-6">Join Vetted.bb and connect with top talent in Barbados.</p>

                {/* Role first — it applies to Google sign-ups too */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">I am signing up as a...</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      ['client', 'Client', 'Find & hire trusted pros'],
                      ['freelancer', 'Freelancer', 'Offer services & get hired'],
                      ['organisation', 'Organisation', 'Hire for a team or agency'],
                    ].map(([val, title, sub]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRole(val)}
                        className={`py-3 px-3 rounded-lg border text-left transition-colors ${role === val ? '' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                        style={role === val ? { backgroundColor: '#00267F', borderColor: '#00267F' } : {}}
                      >
                        <span className={`block text-sm font-semibold ${role === val ? 'text-white' : 'text-gray-700'}`}>{title}</span>
                        <span className="block text-xs mt-0.5" style={{ color: role === val ? '#93b8ff' : '#9ca3af' }}>{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Organisation details sit above both sign-up paths so the
                    Google flow can carry them across the redirect too. */}
                {role === 'organisation' && !invitePending && (
                  <div className="mb-5 rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'rgba(0,38,127,0.03)', border: '1px solid var(--border-card)' }}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation name</label>
                      <input
                        type="text"
                        value={organisationName}
                        onChange={e => setOrganisationName(e.target.value)}
                        placeholder="e.g. Sunrise Events Ltd"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Type of organisation</label>
                      <select
                        value={organisationKind}
                        onChange={e => setOrganisationKind(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white"
                      >
                        {ORG_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </div>
                    <p className="text-xs text-gray-400">You become the owner and can invite colleagues once you&apos;re in.</p>
                  </div>
                )}
                {role === 'organisation' && invitePending && (
                  <p className="mb-5 text-sm rounded-xl px-4 py-3" style={{ backgroundColor: '#EEF2FF', color: '#00267F' }}>
                    You&apos;re joining an organisation by invitation. Create your account and you&apos;ll be added to it automatically.
                  </p>
                )}

                {/* Terms acceptance gates BOTH the Google and email sign-up */}
                <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => { setAgreedToTerms(e.target.checked); if (e.target.checked) setError(null) }}
                    className="mt-0.5 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-600 leading-snug">
                    I agree to Vetted.bb&apos;s{' '}
                    <Link href="/terms" target="_blank" className="font-semibold underline" style={{ color: '#00267F' }}>Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" target="_blank" className="font-semibold underline" style={{ color: '#00267F' }}>Privacy Policy</Link>.
                  </span>
                </label>

                <GoogleAuthButton
                  role={role}
                  organisationName={invitePending ? '' : organisationName}
                  organisationKind={organisationKind}
                  label={role === 'organisation' ? 'Sign up with Google for an organisation' : `Sign up with Google as a ${role}`}
                  disabled={!agreedToTerms || (role === 'organisation' && !invitePending && organisationName.trim().length < 2)}
                />

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or sign up with email</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

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
                      placeholder="At least 8 characters"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 outline-none focus:border-gray-800 bg-white transition-colors"
                    />
                    {/* Live password requirements checklist */}
                    <ul className="mt-2.5 flex flex-col gap-1.5">
                      {POLICY_KEYS.map(key => {
                        const ok = checks[key]
                        return (
                          <li key={key} className="flex items-center gap-2 text-xs" style={{ color: ok ? '#166534' : '#6b7280' }}>
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: ok ? '#16a34a' : '#e5e7eb' }}
                            >
                              {ok ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#9ca3af' }} />
                              )}
                            </span>
                            {POLICY_LABELS[key]}
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !pwValid || !agreedToTerms}
                    className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#00267F' }}
                  >
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>

                  <p className="text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: '#00267F' }}>Log in</Link>
                  </p>
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
