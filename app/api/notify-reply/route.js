import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { notifyThreadClient } from '@/lib/serverThreadNotify'
import { signedInUser, isUuid, isFresh, claimNotification } from '@/lib/serverNotifyGuard'
import { replyNoticeKind } from '@/lib/notifyContent'
import { invoiceSummary } from '@/lib/invoicing'

// Notifies the CLIENT side of a thread when the professional replies or
// sends a quote, invoice, reminder or receipt.
//
// The request carries { reply_id } and nothing else. The caller must be
// signed in, must have written that reply, and must own the professional
// profile the conversation belongs to. What kind of notice it is and what it
// says are read from the reply (and its quote), and the recipients from the
// thread, so the request cannot choose who is emailed or what they are told.
// A reply is announced once, and only while it is new (see
// lib/serverNotifyGuard). The sending itself lives in lib/serverThreadNotify.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for notifications.' }, { status: 500 })
    }

    if (!rateLimit(`notify-reply:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many notifications. Please try again later.' }, { status: 429 })
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const user = await signedInUser(admin, request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const replyId = body?.reply_id
    if (!isUuid(replyId)) {
      return Response.json({ error: 'reply_id required' }, { status: 400 })
    }

    // select('*') so this keeps working before SQL Section 39 adds
    // notified_at: the column simply reads as undefined.
    const { data: reply } = await admin.from('message_replies').select('*').eq('id', replyId).maybeSingle()
    if (!reply) return Response.json({ error: 'Reply not found' }, { status: 404 })

    const { data: thread } = await admin.from('messages').select('id, freelancer_id').eq('id', reply.message_id).maybeSingle()
    if (!thread) return Response.json({ error: 'Thread not found' }, { status: 404 })

    const { data: freelancer } = await admin.from('freelancers').select('user_id').eq('id', thread.freelancer_id).maybeSingle()
    if (reply.sender_user_id !== user.id || freelancer?.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const kind = replyNoticeKind(reply)
    let message = typeof reply.body === 'string' ? reply.body : ''
    if (kind === 'quote') {
      message = ''
    } else if (kind === 'invoice') {
      // The same summary the automatic invoice sends, built from the saved
      // invoice instead of from text in the request.
      const { data: quote } = await admin.from('quotes').select('*').eq('id', reply.quote_id).maybeSingle()
      if (quote?.invoice_number) message = invoiceSummary(quote.invoice_number, quote.total, quote.invoice_due_date)
    } else if (kind === 'reply' && !message) {
      message = 'Photo'
    }

    // Old replies are never announced, and no reply is announced twice. Both
    // answer 200: nothing is wrong, there is just nothing to send.
    if (!isFresh(reply.created_at)) return Response.json({ success: true, sent: false })
    const claim = await claimNotification(admin, 'message_replies', reply.id)
    if (claim === 'already') return Response.json({ success: true, sent: false })
    if (claim === 'error') return Response.json({ error: 'Could not send the notification.' }, { status: 500 })

    const result = await notifyThreadClient(admin, { messageId: thread.id, kind, message })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status || 500 })
    }
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
