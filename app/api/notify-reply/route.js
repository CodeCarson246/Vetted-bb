import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { notifyThreadClient } from '@/lib/serverThreadNotify'

// Notifies the CLIENT side of a thread when the freelancer replies or
// sends a quote, invoice, reminder or receipt. The recipients (and the
// freelancer's display name) are looked up server-side from message_id, so
// the request body can't choose who gets emailed and this can't be used as
// a relay. The work itself lives in lib/serverThreadNotify.
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ error: 'Server is not configured for notifications.' }, { status: 500 })
    }

    if (!rateLimit(`notify-reply:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many notifications. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const messageId = body.message_id
    if (!messageId) {
      return Response.json({ error: 'message_id required' }, { status: 400 })
    }
    const kind = ['quote', 'invoice', 'reminder', 'receipt'].includes(body.kind) ? body.kind : 'reply'

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const result = await notifyThreadClient(admin, { messageId, kind, message: body.message })
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status || 500 })
    }
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
