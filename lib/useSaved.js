'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'

/**
 * Saved-professionals state for the current user.
 * Optimistic toggle — the heart flips instantly, the row syncs behind it.
 * Returns 'login' from toggleSaved when there's no session so callers
 * can redirect or prompt.
 */
const EMPTY_SET = new Set()

export function useSaved() {
  const { user } = useAuth()
  const [fetchedIds, setFetchedIds] = useState(() => new Set())

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('saved_professionals')
      .select('freelancer_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!cancelled) setFetchedIds(new Set((data || []).map(r => r.freelancer_id)))
      })
    return () => { cancelled = true }
  }, [user])

  // Derive rather than reset-on-logout — no setState needed in the effect
  const savedIds = user ? fetchedIds : EMPTY_SET
  const setSavedIds = setFetchedIds

  const toggleSaved = useCallback(async (freelancerId) => {
    if (!user) return 'login'
    if (savedIds.has(freelancerId)) {
      setSavedIds(prev => {
        const next = new Set(prev)
        next.delete(freelancerId)
        return next
      })
      const { error } = await supabase
        .from('saved_professionals')
        .delete()
        .eq('user_id', user.id)
        .eq('freelancer_id', freelancerId)
      if (error) {
        // Revert the optimistic removal so the UI matches reality
        setSavedIds(prev => new Set(prev).add(freelancerId))
        console.error('[saved] delete failed:', error)
        return 'error'
      }
      return 'removed'
    }
    setSavedIds(prev => new Set(prev).add(freelancerId))
    const { error } = await supabase
      .from('saved_professionals')
      .insert({ user_id: user.id, freelancer_id: freelancerId })
    if (error) {
      setSavedIds(prev => {
        const next = new Set(prev)
        next.delete(freelancerId)
        return next
      })
      console.error('[saved] insert failed:', error)
      return 'error'
    }
    // Notify the freelancer they were saved (fire-and-forget, deduped server-side)
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (token) fetch('/api/notify-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ freelancer_id: freelancerId }),
      }).catch(() => {})
    })
    return 'saved'
  }, [user, savedIds, setSavedIds])

  return { savedIds, toggleSaved, isLoggedIn: !!user }
}

/** Small reusable heart button. */
export function HeartButton({ saved, onClick, size = 18, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || (saved ? 'Remove from saved' : 'Save for later')}
      aria-label={title || (saved ? 'Remove from saved' : 'Save for later')}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? '#ef4444' : 'none'}
        stroke={saved ? '#ef4444' : '#9CA3AF'}
        strokeWidth="2"
        style={{ transition: 'fill 0.15s, stroke 0.15s, transform 0.15s' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  )
}
