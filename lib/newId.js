// A fresh row id (a version 4 UUID) made in the browser.
//
// The notification routes are given the id of the row that was just saved
// and nothing else. Choosing the id here means the page already knows it, so
// it never has to read the row back after saving it (which depends on the
// read rules for that table and would turn a saved message into an error
// wherever they are stricter than the write rules).
export function newId() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  // Older browsers: the same thing by hand.
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
