import { createClient } from '@supabase/supabase-js'

/**
 * Server-only: create an in-app notification for a recipient. Uses the
 * service-role key because RLS forbids one user inserting a row for another
 * (mirrors lib/serverPush.js). Fire-and-forget — silently no-ops if the key
 * or userId is missing, and swallows the unique-violation that a duplicate
 * dedupeKey raises (so daily digests / "saved you" stay idempotent).
 *
 * @param {string} userId   recipient (auth.users id)
 * @param {object} n        { type, title, body?, link?, dedupeKey? }
 * @returns {'created'|'duplicate'|'skipped'}  'duplicate' means a row with
 *   this dedupeKey was already there, so the caller can hold back the push
 *   that would otherwise repeat it.
 */
export async function createNotification(userId, { type, title, body = null, link = null, dedupeKey = null } = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !userId || !type || !title) return 'skipped'

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      link,
      dedupe_key: dedupeKey,
    })
    // 23505 = unique_violation (duplicate dedupe_key) — expected, ignore.
    if (error && error.code === '23505') return 'duplicate'
    if (error) {
      console.error('createNotification failed:', error.message)
      return 'skipped'
    }
    return 'created'
  } catch (err) {
    console.error('createNotification threw:', err.message)
    return 'skipped'
  }
}
