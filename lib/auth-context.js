'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Realtime applies our RLS policies (which use auth.uid()) to
    // postgres_changes — without the socket carrying the user's token it
    // delivers NOTHING, so live updates silently fall back to slow polling.
    // Push the token into Realtime on every session change.
    const syncRealtimeAuth = (s) => {
      // setAuth may be sync or return a promise depending on supabase-js
      // version — guard both so a rejection can't surface as unhandled.
      try { Promise.resolve(supabase.realtime.setAuth(s?.access_token ?? null)).catch(() => {}) } catch { /* ignore */ }
    }

    // Single getSession call for the entire app
    supabase.auth.getSession().then(({ data }) => {
      syncRealtimeAuth(data.session)
      setSession(data.session)
      setLoading(false)
    })

    // Single onAuthStateChange subscription for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        syncRealtimeAuth(session)
        setSession(session)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
