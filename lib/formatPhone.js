// Phone numbers on documents, written the way Barbados writes them:
// (246) 833-1123. Numbers arrive in many shapes (verified numbers are stored
// as +12468331123, people type 246-833-1123 or just 833-1123), so this reads
// the digits and formats any North American number. A 7-digit number is
// local, so it gets the 246 area code. Anything else (a foreign number, an
// extension, words) is returned exactly as typed rather than mangled.
export function formatPhone(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/[a-z]/i.test(raw)) return raw
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length === 7) digits = '246' + digits
  if (digits.length !== 10) return raw
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
