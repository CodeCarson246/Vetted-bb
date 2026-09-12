// Short document verification code, printed on every quote, invoice and
// receipt and looked up at /verify/<code>. Same alphabet as the database
// backfill in SUPABASE_SQL.sql section 28: no look-alike characters, so it
// can be read off paper and typed without ambiguity.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateVerifyCode(length = 10) {
  const out = []
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < length; i++) out.push(ALPHABET[bytes[i] % ALPHABET.length])
  } else {
    for (let i = 0; i < length; i++) out.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)])
  }
  return out.join('')
}

// Grouped for reading: ABCDE-FGHJK
export function formatVerifyCode(code) {
  const c = (code || '').toUpperCase()
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c
}

export function normaliseVerifyCode(input) {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
