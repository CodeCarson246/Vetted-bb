'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { TERMS_VERSION, hasAcceptedCurrentTerms } from '@/lib/terms'

// Shown to a logged-in user whose recorded Terms acceptance is missing or
// behind the current version (see lib/terms.js). Accepting stamps the current
// version + timestamp into auth user_metadata; that fires a USER_UPDATED event
// which refreshes useAuth, so the banner disappears on its own. New signups
// already carry the current version and never see this.
export default function TermsUpdateNotice() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)

  if (!user || accepted || hasAcceptedCurrentTerms(user)) return null

  async function accept() {
    setBusy(true)
    const { error } = await supabase.auth.updateUser({
      data: { terms_accepted_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
    })
    setBusy(false)
    if (!error) setAccepted(true)
  }

  return (
    <div style={{ backgroundColor: '#00267F', color: '#fff', padding: '10px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center' }}>
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          We&apos;ve updated our{' '}
          <Link href="/terms" target="_blank" style={{ color: '#F9C000', fontWeight: 600, textDecoration: 'underline' }}>Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" target="_blank" style={{ color: '#F9C000', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</Link>. Please review and accept to continue.
        </span>
        <button
          onClick={accept}
          disabled={busy}
          style={{ fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 999, border: 'none', backgroundColor: '#F9C000', color: '#00267F', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Saving…' : 'I accept'}
        </button>
      </div>
    </div>
  )
}
