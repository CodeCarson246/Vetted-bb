import { quoteReplyKind } from './quoteReply.js'

// What a notification says is worked out on the server from the saved row,
// never taken from the request. These are the pure parts of that, kept apart
// so they can be tested without a database.

// The profile's contact form adds to an existing conversation with one of
// these labels on top, so the professional can see where a new enquiry
// starts. The label belongs in the thread, not in the notification.
const ENQUIRY_LABELS = ['--- New service enquiry ---', '--- New message ---']

// A new conversation: its own subject and text.
export function enquiryNoticeFromMessage(msg) {
  return {
    subject: String(msg?.subject || '').slice(0, 200),
    message: String(msg?.message || '').slice(0, 5000),
  }
}

// A client's reply in a conversation that already exists.
export function enquiryNoticeFromReply(reply, thread) {
  let body = typeof reply?.body === 'string' ? reply.body : ''
  for (const label of ENQUIRY_LABELS) {
    if (body.startsWith(label)) { body = body.slice(label.length).replace(/^\s+/, ''); break }
  }
  return {
    subject: `Re: ${thread?.subject || 'your conversation'}`.slice(0, 200),
    message: (body || 'Photo').slice(0, 5000),
  }
}

// The reminder line written by the Quotes page ("Friendly reminder: invoice
// INV-... for $..."). Matched closely so an ordinary reply that happens to
// open with the same two words is not announced as a payment reminder.
const REMINDER_LINE = /^Friendly reminder: invoice \S+ for \$/

// Which kind of notice a professional's reply is: read from the row itself
// (a quote, invoice or receipt carries a quote_id), not from the request.
export function replyNoticeKind(reply) {
  const kind = quoteReplyKind(reply)
  if (kind) return kind
  const body = typeof reply?.body === 'string' ? reply.body : ''
  return REMINDER_LINE.test(body) ? 'reminder' : 'reply'
}
