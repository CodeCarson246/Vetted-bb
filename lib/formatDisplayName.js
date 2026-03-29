/**
 * Formats a reviewer identity for public display.
 *
 * Rules:
 *   1. Real name already stored  →  returned as-is  ("John Smith" → "John Smith")
 *   2. Email address             →  "FirstName L."  ("carson.pitts@gmail.com" → "Carson P.")
 *   3. Falsy / unresolvable      →  "Client"
 *
 * Never exposes a raw email address on a public-facing page.
 */
export function formatDisplayName(author) {
  if (!author) return 'Client'
  if (!author.includes('@')) return author  // already a real name

  // It's an email — derive first name + last initial only
  const local = author.split('@')[0]                          // "carson.pitts" | "carsonpitts8"
  const parts = local.split(/[._-]/).filter(p => /[a-zA-Z]/.test(p))

  if (parts.length === 0) return 'Client'

  const rawFirst = parts[0].replace(/\d+$/, '')               // strip trailing digits
  if (!rawFirst) return 'Client'

  const first = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()

  if (parts.length >= 2) {
    const lastInitial = parts[1].replace(/\d+$/, '').charAt(0).toUpperCase()
    if (lastInitial) return `${first} ${lastInitial}.`
  }

  return first
}
