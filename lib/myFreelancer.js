'use client'
import { supabase } from './supabase'

// The signed-in user's freelancer row, shared by the app chrome, the
// workspace sidebar and the dashboard. All three mount together on every
// freelancer page and used to fetch the same row separately: three database
// round trips where one will do, and each costs a quarter to over a second
// when Supabase is cold.
//
// Callers that ask at the same time share one request, and the answer is
// reused for a few seconds only, so a change made on another page still
// shows up on the next navigation. The dashboard primes it after edits.
const REUSE_MS = 5000
let entry = null // { userId, at, pending, promise }

export function getMyFreelancer(userId) {
  if (!userId) return Promise.resolve(null)
  if (entry && entry.userId === userId && (entry.pending || Date.now() - entry.at < REUSE_MS)) {
    return entry.promise
  }
  const e = { userId, at: Date.now(), pending: true, promise: null }
  e.promise = supabase
    .from('freelancers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
    .then(
      ({ data, error }) => {
        e.pending = false
        e.at = Date.now()
        // A failed lookup is not remembered: the next caller tries again.
        if (error) { if (entry === e) entry = null; return null }
        return data || null
      },
      () => { e.pending = false; if (entry === e) entry = null; return null },
    )
  entry = e
  return e.promise
}

// The dashboard just changed the row: let the sidebar and chrome see it.
export function primeMyFreelancer(userId, row) {
  if (userId && row) entry = { userId, at: Date.now(), pending: false, promise: Promise.resolve(row) }
}

export function forgetMyFreelancer() {
  entry = null
}
