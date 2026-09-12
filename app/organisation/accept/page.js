'use client'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { stashPendingInvite, consumePendingInvite } from '@/lib/organisations'

// Where an invite link lands. Signed in: redeem it and go to the workspace.
// Not signed in: park the token and offer sign-up or log-in; it is redeemed
// automatically once they're in.
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="min-h-screen page-bg" />}>
      <AcceptInvite />
    </Suspense>
  )
}

function AcceptInvite() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const { user, loading } = useAuth()
  // A link with no code is an error from the first render; no effect needed.
  const [status, setStatus] = useState(() => (token ? 'working' : 'error')) // working | need-login | error
  const [error, setError] = useState(() => (token ? '' : 'This invitation link is missing its code.'))

  useEffect(() => {
    if (!token || loading || !user) {
      // Not signed in yet: park the token so signup/login can redeem it.
      if (token) stashPendingInvite(token)
      return
    }
    stashPendingInvite(token)
    consumePendingInvite().then(joined => {
      if (joined) router.replace('/organisation')
      else { setError('This invitation could not be used. It may have expired, already been used, or been sent to a different email address.'); setStatus('error') }
    })
  }, [token, user, loading, router])

  // "Need to log in" is a fact about auth, not something the effect decides.
  const view = status === 'error' ? 'error' : (!loading && !user ? 'need-login' : status)

  return (
    <main className="min-h-screen page-bg flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl w-full max-w-md p-7 sm:p-8 text-center" style={{ borderTop: '4px solid #00267F', boxShadow: '0 2px 12px rgba(0,38,127,0.08)' }}>
        {view === 'working' && (
          <>
            <p className="text-3xl mb-3" aria-hidden="true">🏢</p>
            <p className="text-sm text-gray-500">Adding you to the organisation…</p>
          </>
        )}

        {view === 'need-login' && (
          <>
            <p className="text-3xl mb-3" aria-hidden="true">🏢</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You’ve been invited to join an organisation</h1>
            <p className="text-sm text-gray-500 mb-6">Create an account or log in with the email address the invitation was sent to, and you’ll be added automatically.</p>
            <div className="flex flex-col gap-2.5">
              <Link href="/signup?role=organisation" className="w-full text-white py-3 rounded-full font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: '#00267F' }}>
                Create an account
              </Link>
              <Link href="/login" className="w-full py-3 rounded-full font-semibold border transition-colors hover:border-gray-400" style={{ borderColor: '#00267F', color: '#00267F' }}>
                I already have an account
              </Link>
            </div>
          </>
        )}

        {view === 'error' && (
          <>
            <p className="text-3xl mb-3" aria-hidden="true">😕</p>
            <h1 className="text-lg font-bold text-gray-900 mb-1">We couldn’t use that invitation</h1>
            <p className="text-sm text-gray-500 mb-5">{error}</p>
            <p className="text-xs text-gray-400">Ask the person who invited you to send a fresh link.</p>
          </>
        )}
      </div>
    </main>
  )
}
