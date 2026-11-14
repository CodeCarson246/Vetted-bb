'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Is the signed-in person an admin? Used only to decide whether to show the
// Admin link. Who is an admin stays on the server (ADMIN_EMAILS, never sent
// to the browser): this asks /api/admin?check=1, which answers 200 for an
// admin and 401/403 for anyone else. The admin page and every admin action
// check again on the server, so a wrong answer here can only show or hide a
// link, never grant anything.
//
// The answer is kept for the browser tab (per account), so moving between
// pages does not ask again.
const KEY = uid => `vetted_admin:${uid}`

function remembered(uid) {
  try { return sessionStorage.getItem(KEY(uid)) } catch { return null }
}

export function useIsAdmin(user) {
  const uid = user?.id || null
  const [answer, setAnswer] = useState(() => (uid ? remembered(uid) : null))

  useEffect(() => {
    if (!uid) return
    const known = remembered(uid)
    if (known !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a cached answer for a new account
      setAnswer(known)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data?.session?.access_token
        if (!token) return
        const res = await fetch('/api/admin?check=1', { headers: { Authorization: `Bearer ${token}` } })
        // Only a definite answer is remembered; a network or server error is
        // asked again on the next page.
        if (res.status === 200 || res.status === 403) {
          const value = res.status === 200 ? '1' : '0'
          try { sessionStorage.setItem(KEY(uid), value) } catch { /* ignore */ }
          if (!cancelled) setAnswer(value)
        }
      } catch { /* leave the link hidden */ }
    })()
    return () => { cancelled = true }
  }, [uid])

  return !!uid && answer === '1' && remembered(uid) !== '0'
}
