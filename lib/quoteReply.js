/**
 * A reply row represents a quote when it carries a quote_id.
 * Older rows (before the quote_id column existed) encoded the quote
 * as a '__QUOTE__<uuid>' body, so fall back to that for legacy data.
 */
const LEGACY_PREFIX = '__QUOTE__'

export function getQuoteId(reply) {
  if (!reply) return null
  if (reply.quote_id) return reply.quote_id
  if (typeof reply.body === 'string' && reply.body.startsWith(LEGACY_PREFIX)) {
    return reply.body.slice(LEGACY_PREFIX.length)
  }
  return null
}

// Classify a quote-bearing reply by the document it represents, read from
// the body prefix written when it was sent (invoice/receipt replies also
// carry a quote_id, so quote_id alone can't tell them apart).
export function quoteReplyKind(reply) {
  if (!getQuoteId(reply)) return null
  const body = typeof reply?.body === 'string' ? reply.body : ''
  if (body.startsWith('Sent receipt')) return 'receipt'
  if (body.startsWith('Sent invoice')) return 'invoice'
  return 'quote'
}

// One-line summary of a thread's latest reply for the conversation list.
// Quote/invoice/receipt rows get a labelled, perspective-aware summary
// (e.g. "Receipt received" once a job is paid) rather than a generic
// "Quote" line that goes stale; plain replies show their text, prefixed
// with "You: " when sent by the current user.
export function conversationPreview(reply, currentUserId) {
  if (!reply) return null
  const isOwn = reply.sender_user_id === currentUserId
  const kind = quoteReplyKind(reply)
  if (kind) {
    const label = { quote: '📄 Quote', invoice: '🧾 Invoice', receipt: '✅ Receipt' }[kind]
    return `${label} ${isOwn ? 'sent' : 'received'}`
  }
  const body = typeof reply.body === 'string' ? reply.body : ''
  return `${isOwn ? 'You: ' : ''}${body}`
}

// The visible identity of a quote-bearing reply's card. A quote, its later
// invoice, and its receipt share a quote_id but show different documents, so
// the card KIND is part of the key — only genuinely identical cards collapse.
function quoteCardKey(reply, quotes) {
  const qid = getQuoteId(reply)
  if (!qid) return null
  const q = quotes[qid]
  const body = typeof reply.body === 'string' ? reply.body : ''
  if (q?.paid_at && body.startsWith('Sent receipt')) return `receipt:${q.invoice_number || q.quote_number || qid}`
  if (q?.invoice_number && body.startsWith('Sent invoice')) return `invoice:${q.invoice_number}`
  return `quote:${q?.quote_number || qid}`
}

/**
 * Collapse duplicates in a thread to a single source of truth before render:
 *  - the same reply row id never renders twice (defensive against duplicate
 *    inserts / re-appends), and
 *  - a quote/invoice/receipt document renders once even when several reply
 *    rows reference it — e.g. a double-submitted quote creates multiple rows
 *    that share one quote_number and would otherwise show identical cards.
 * Keeps the earliest occurrence; preserves all plain (non-quote) replies.
 */
export function dedupeThreadReplies(list, quotes = {}) {
  const seenIds = new Set()
  const seenCards = new Set()
  const out = []
  for (const r of list || []) {
    if (r?.id != null) {
      if (seenIds.has(r.id)) continue
      seenIds.add(r.id)
    }
    const key = quoteCardKey(r, quotes)
    if (key) {
      if (seenCards.has(key)) continue
      seenCards.add(key)
    }
    out.push(r)
  }
  return out
}
