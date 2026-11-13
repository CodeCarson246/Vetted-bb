// Server-only checks shared by the notification routes (/api/notify-message
// and /api/notify-reply). Those routes send email and push, so they accept
// nothing but the id of a saved row and work everything else out from it.
// These helpers are the three questions each one asks first:
//
//   who is calling        signedInUser
//   is the row recent     isFresh
//   has it been announced claimNotification

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

// The signed-in user behind the request's bearer token, or null.
export async function signedInUser(admin, request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : (data?.user || null)
}

// A row is only announced while it is new. Five minutes is far longer than
// the moment between saving a message and asking for its notification, and
// short enough that nobody can go back through old conversations and set
// them off again.
export const NOTIFY_WINDOW_MS = 5 * 60_000

// messages.created_at has no time zone and holds UTC; without a suffix
// Date.parse would read it in the server's local zone.
function rowTime(createdAt) {
  if (!createdAt) return NaN
  const text = String(createdAt)
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`)
}

export function isFresh(createdAt, now = Date.now()) {
  const at = rowTime(createdAt)
  return Number.isFinite(at) && now - at <= NOTIFY_WINDOW_MS
}

// One notification per row, ever. Stamps notified_at only where it is still
// empty, so of two requests for the same row exactly one gets 'claimed'.
//
//   'claimed'    go ahead and send
//   'already'    this row has been announced; send nothing
//   'unstamped'  the column is not there yet (SQL Section 39 not run), so
//                there is nothing to stamp. Send anyway: the sender and
//                freshness checks still apply.
//   'error'      something else went wrong; send nothing
export async function claimNotification(admin, table, id) {
  const { data, error } = await admin
    .from(table)
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id)
    .is('notified_at', null)
    .select('id')
  if (error) {
    const missingColumn = error.code === '42703' || error.code === 'PGRST204' || /notified_at/.test(error.message || '')
    return missingColumn ? 'unstamped' : 'error'
  }
  return (data || []).length > 0 ? 'claimed' : 'already'
}
