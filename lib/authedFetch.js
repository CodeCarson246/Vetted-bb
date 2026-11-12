'use client'
import { supabase } from './supabase'

// A request to one of our own API routes, carrying the signed-in user's
// token. The routes check that token with the auth server, and it can be
// stale in the first moments after a phone wakes the app, or dead if the
// session was ended from another device. Showing the route's bare
// "Unauthorized" tells the person nothing, so:
//
//   1. send the request with the current token;
//   2. on a 401, get a fresh token and try once more;
//   3. if that also fails, answer with a message that says what to do.
//
// Returns { ok, status, data }: `data` is the parsed JSON body, and on
// failure `data.error` is always a sentence fit to show.
export const SIGNED_OUT_MESSAGE = 'You have been signed out on this device. Please log in again, then retry.'

async function send(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function authedPost(url, body) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    let out = session?.access_token ? await send(url, session.access_token, body) : { ok: false, status: 401, data: {} }
    if (out.status === 401) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      const token = refreshed?.session?.access_token
      out = token ? await send(url, token, body) : out
      if (out.status === 401) out = { ok: false, status: 401, data: { error: SIGNED_OUT_MESSAGE } }
    }
    if (!out.ok && !out.data?.error) out.data = { ...out.data, error: 'Something went wrong. Please try again.' }
    return out
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the site. Check your connection and try again.' } }
  }
}
