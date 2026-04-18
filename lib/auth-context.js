'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Single getSession call for the entire app
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Single onAuthStateChange subscription for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    // Suppress "Failed to fetch" noise caused by network interruptions
    const handler = (event) => {
      if (event.reason?.message === 'Failed to fetch') {
        event.preventDefault()
        console.warn('Network request failed — user may be offline')
      }
    }
    window.addEventListener('unhandledrejection', handler)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('unhandledrejection', handler)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
