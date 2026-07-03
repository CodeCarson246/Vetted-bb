'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// Shown on every page while the logged-in user's account is deactivated.
// Reads the user's own account_deactivations row (RLS: own row only) and
// offers one-click reactivation before the 60-day purge date.
export default function DeactivationNotice() {
  const { user } = useAuth()
  const uid = user?.id
  const [row, setRow] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    supabase.from('account_deactivations').select('purge_after').eq('user_id', uid).maybeSingle()
      .then(({ data }) => { if (!cancelled) setRow(data || null) })
    return () => { cancelled = true }
  }, [uid])

  // Render guard covers logout too — a stale row is refetched on next login
  if (!uid || !row) return null

  const purgeDate = new Date(row.purge_after).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  async function reactivate() {
    setBusy(true)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'reactivate' }),
    })
    setBusy(false)
    if (res.ok) {
      setRow(null)
      // Profile visibility just changed — repaint whatever page we're on
      window.location.reload()
    }
  }

  return (
    <div style={{ backgroundColor: '#7f1d1d', color: '#fff', padding: '10px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', textAlign: 'center' }}>
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          Your account is deactivated and will be <strong>permanently deleted on {purgeDate}</strong>.
        </span>
        <button
          onClick={reactivate}
          disabled={busy}
          style={{ fontSize: 13, fontWeight: 700, padding: '6px 16px', borderRadius: 999, border: 'none', backgroundColor: '#fff', color: '#7f1d1d', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Reactivating…' : 'Reactivate account'}
        </button>
      </div>
    </div>
  )
}
