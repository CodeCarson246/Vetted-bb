'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Phone verification card for the freelancer dashboard.
 *
 * Uses Supabase's built-in phone OTP — updateUser({ phone }) sends a
 * code to the existing (email-authenticated) user, verifyOtp confirms
 * it. On success we call /api/verify-phone, which flips the protected
 * phone_verified flag after re-checking the confirmation server-side.
 *
 * The SMS/WhatsApp provider (Twilio) is configured in the Supabase
 * dashboard, so there are no credentials in this app.
 */
export default function PhoneVerify({ verified, onVerified }) {
  const [step, setStep] = useState(verified ? 'done' : 'idle') // idle | code | done
  const [phone, setPhone] = useState('+1246')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0) // seconds until resend allowed

  const cleanPhone = () => phone.replace(/[\s()-]/g, '')

  // Reconcile on mount: if Supabase Auth already shows a confirmed phone
  // but our profile flag is still off (e.g. a previous attempt verified
  // the OTP but the server write failed), finish it now — no new code.
  useEffect(() => {
    if (verified) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user?.phone_confirmed_at || !user?.phone) return
      const ok = await finalize()
      if (ok && !cancelled) { setStep('done'); onVerified?.() }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick the resend cooldown down to zero
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Calls the server route that flips phone_verified after re-checking
  // the confirmation. Returns true on success.
  async function finalize() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/verify-phone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Could not finish verification. Please try again.')
      return false
    }
    return true
  }

  async function sendCode() {
    setBusy(true); setError(null)
    const p = cleanPhone()
    if (!/^\+\d{8,15}$/.test(p)) {
      setError('Enter your number in international format, e.g. +1246XXXXXXX')
      setBusy(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ phone: p })
    if (error) {
      // Surface the real Supabase message — it pinpoints provider/config issues
      console.error('[phone-verify] updateUser error:', error)
      const m = /after (\d+) seconds/.exec(error.message || '')
      if (m) setCooldown(Number(m[1]))
      setError(error.message || 'Could not send the code. Please try again.')
    } else {
      setStep('code')
      setCooldown(60) // Supabase throttles repeat sends ~60s
    }
    setBusy(false)
  }

  async function verify() {
    setBusy(true); setError(null)
    const { error } = await supabase.auth.verifyOtp({
      phone: cleanPhone(),
      token: code.trim(),
      type: 'phone_change',
    })
    if (error) {
      setError(error.message.includes('expired') || error.message.includes('invalid')
        ? 'That code didn’t match. Check it and try again.'
        : error.message)
      setBusy(false)
      return
    }
    const ok = await finalize()
    if (ok) {
      setStep('done')
      onVerified?.()
    }
    setBusy(false)
  }

  const accent = step === 'done' ? '#16a34a' : '#00267F'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: step === 'done' ? 'rgba(22,163,74,0.12)' : 'rgba(0,38,127,0.08)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
            {step === 'done'
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />}
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900">
            {step === 'done' ? 'Phone verified' : 'Verify your phone number'}
          </p>

          {step === 'done' && (
            <p className="text-xs text-gray-500 mt-0.5">
              Your profile shows a verified badge so clients know you’re a real, reachable professional.
            </p>
          )}

          {step === 'idle' && (
            <>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Confirm a real phone number to earn the verified badge on your profile. We never show your number publicly.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1246XXXXXXX"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white"
                />
                <button
                  onClick={sendCode}
                  disabled={busy}
                  className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: '#00267F' }}
                >
                  {busy ? 'Sending…' : 'Send code'}
                </button>
              </div>
            </>
          )}

          {step === 'code' && (
            <>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Enter the code we sent to <span className="font-medium text-gray-700">{cleanPhone()}</span>.
                <button onClick={() => { setStep('idle'); setCode(''); setError(null) }} className="ml-1 underline hover:opacity-80" style={{ color: '#00267F' }}>Change number</button>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-gray-400 bg-white tracking-widest"
                />
                <button
                  onClick={verify}
                  disabled={busy || !code.trim()}
                  className="text-sm font-semibold px-4 py-2 rounded-full text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {busy ? 'Verifying…' : 'Verify'}
                </button>
              </div>
              <button
                onClick={sendCode}
                disabled={busy || cooldown > 0}
                className="text-xs mt-2 hover:opacity-80 disabled:opacity-50"
                style={{ color: '#00267F' }}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Didn’t get it? Resend code'}
              </button>
            </>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
