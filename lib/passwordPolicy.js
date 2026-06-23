// Shared password policy — the single source of truth for both the signup
// form (live checklist) and the /api/signup server route (authoritative
// enforcement). Keep the two in lockstep by importing from here.

export const POLICY_LABELS = {
  length: 'At least 8 characters',
  uppercase: 'One uppercase letter',
  letterNumber: 'A mix of letters and numbers',
  special: 'One special character (e.g. ! ? @ #)',
  noPersonal: "Doesn't contain your name or email",
}

// The display order of the checklist.
export const POLICY_KEYS = ['length', 'uppercase', 'letterNumber', 'special', 'noPersonal']

export function passwordChecks(password = '', { name = '', email = '' } = {}) {
  const pwd = String(password)
  const lower = pwd.toLowerCase()

  const nameParts = String(name).toLowerCase().split(/\s+/).filter(p => p.length >= 3)
  const emailLocal = String(email).split('@')[0].toLowerCase()
  const containsName = nameParts.some(p => lower.includes(p))
  const containsEmail = emailLocal.length >= 3 && lower.includes(emailLocal)

  return {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    letterNumber: /[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd),
    // Any non-alphanumeric, non-space symbol — matches Supabase Auth's
    // "symbols" character-class requirement so the form and the auth layer
    // agree (users no longer pass our checks then get rejected by Supabase).
    special: /[^A-Za-z0-9\s]/.test(pwd),
    // Only meaningful once something is typed — an empty password is "fine"
    // here so the tick doesn't show green before the user starts.
    noPersonal: pwd.length > 0 && !containsName && !containsEmail,
  }
}

export function validatePassword(password, ctx) {
  const checks = passwordChecks(password, ctx)
  const valid = POLICY_KEYS.every(k => checks[k])
  return { valid, checks }
}
