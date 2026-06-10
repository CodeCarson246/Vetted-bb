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
