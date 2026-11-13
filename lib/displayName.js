// A person's or organisation's name, made safe to put in the title of a
// notification or the subject of an email.
//
// Names are chosen by the people they belong to (the "full name" on an
// account, an organisation's name), so a name can hold anything: a link, a
// line of instructions, several hundred characters. Whatever it holds is
// then delivered under Vetted.bb's own name. This keeps it looking like a
// name: one line, no links, and short.
const MAX = 60

export function safeDisplayName(value, fallback = 'Someone') {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')         // control characters and line breaks
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')    // links
    .replace(/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|info|biz|co|io|bb|ly|me|app|xyz|ru|cn)\b\S*/gi, ' ') // bare web addresses
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return fallback
  return text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text
}
