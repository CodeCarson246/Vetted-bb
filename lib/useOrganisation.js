'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-context'
import { fetchMyOrganisation, isOrganisationUser } from './organisations'

// Shared loader for the organisation workspace pages. Redirects anyone who
// is not signed in as an organisation user, and sends organisation users
// with no organisation yet to the setup page. Returns the org, the caller's
// role in it, and a refresh() for after edits.
export function useOrganisation({ allowMissing = false } = {}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [org, setOrg] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const entry = await fetchMyOrganisation()
    setOrg(entry?.organisation || null)
    setRole(entry?.role || null)
    return entry
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    if (!isOrganisationUser(user)) { router.replace('/dashboard'); return }
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; state is set after the await inside refresh(), not synchronously
    refresh().then(entry => {
      if (cancelled) return
      if (!entry && !allowMissing) { router.replace('/organisation/setup'); return }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user, authLoading, router, refresh, allowMissing])

  return { user, org, role, isOwner: role === 'owner', loading: authLoading || loading, refresh }
}
