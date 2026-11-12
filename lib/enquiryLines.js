// The "• Name: price" lines of a service enquiry: written on the profile
// when a client picks services, read back in the professional's inbox to
// offer "Quote this service →" with the quote already filled in.
//
// Writing and reading live side by side, with a round-trip test, because
// they drifted once: the profile started writing "Bds$40" while the inbox
// still only understood "$40", and the button quietly disappeared.
import { parsePrice } from './price.js'

/** One line of an enquiry. A price that is not a number is passed through. */
export function serviceEnquiryLine(name, price) {
  const label = String(name || 'Service').replace(/[\n\r]+/g, ' ').trim()
  const n = parsePrice(price)
  const priceText = n !== null ? `Bds$${Number.isInteger(n) ? n : n.toFixed(2)}` : String(price ?? '').trim()
  return `• ${label}: ${priceText}`
}

// Reads a line written by serviceEnquiryLine, in any form it has ever taken:
// "$40", "Bds$40", "BBD $40.00", "40". Returns { name, price } or null.
export function parseServiceEnquiryLine(line) {
  const m = String(line || '').match(/^\s*[•\-*]\s*(.+?):\s*(?:bds|bbd)?\s*\$?\s*([\d,]+(?:\.\d+)?)\s*\+?\s*$/i)
  if (!m) return null
  const price = parsePrice(m[2])
  if (price === null) return null
  return { name: m[1].trim(), price }
}
