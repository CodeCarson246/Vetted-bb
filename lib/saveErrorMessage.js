// What to tell someone when saving their profile fails.
//
// The forms used to say only "Something went wrong", which hid the cause
// the one time saving was broken (April 2026). This keeps the wording plain
// and adds the database's own reason, so a screenshot is enough to fix it.
const PLAIN = {
  '23502': 'A required field is empty.',
  '23514': 'One of the values is not allowed.',
  '22P02': 'One of the values is in the wrong format.',
  '22001': 'One of the fields is too long.',
  '42501': 'You do not have permission to change this.',
  PGRST301: 'You have been signed out. Please log in again.',
}

export function saveErrorMessage(error) {
  if (!error) return 'Could not save your changes. Please try again.'
  const plain = PLAIN[error.code] || 'Could not save your changes.'
  const detail = String(error.message || '').trim().slice(0, 160)
  return detail ? `${plain} (${detail})` : `${plain} Please try again.`
}
