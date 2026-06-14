import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { createNotification } from '@/lib/serverNotify'
import { sendPushToUser } from '@/lib/serverPush'

// Cross-party quote-lifecycle notifications. The caller (JWT) must be a
// participant in the quote; the recipient (the OTHER party) is resolved
// server-side, so the body can't choose who gets notified.
//   accepted | declined  → client acted   → notify freelancer
//   paid                 → freelancer acted → notify client
//   completed            → either acted    → notify the other side
export async function POST(request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Not configured.' }, { status: 500 })

    if (!rateLimit(`quote-event:${clientIp(request)}`, { limit: 30, windowMs: 10 * 60_000 })) {
      return Response.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { quote_id, event } = await request.json()
    const EVENTS = ['accepted', 'declined', 'completed', 'paid']
    if (!quote_id || !EVENTS.includes(event)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { data: quote } = await admin
      .from('quotes')
      .select('id, message_id, client_email, client_name, quote_number, invoice_number, freelancer_id, freelancers(user_id, name, company_name)')
      .eq('id', quote_id)
      .maybeSingle()
    if (!quote) return Response.json({ error: 'Quote not found' }, { status: 404 })

    const freelancerUserId = quote.freelancers?.user_id
    const freelancerName = quote.freelancers?.company_name?.trim().length > 3
      ? quote.freelancers.company_name
      : quote.freelancers?.name || 'The professional'

    // Resolve the client's user id from the thread (sender), if any
    let clientUserId = null
    if (quote.message_id) {
      const { data: msg } = await admin.from('messages').select('sender_user_id').eq('id', quote.message_id).maybeSingle()
      clientUserId = msg?.sender_user_id || null
    }

    // Authorise: caller must be the freelancer owner or the addressed client
    const isFreelancer = user.id === freelancerUserId
    const isClient = (quote.client_email && user.email && quote.client_email === user.email) || user.id === clientUserId
    if (!isFreelancer && !isClient) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ref = quote.invoice_number || quote.quote_number || ''
    const clientName = quote.client_name || 'The client'

    let recipient = null
    let payload = null
    if (event === 'accepted' || event === 'declined') {
      recipient = freelancerUserId
      payload = { type: `quote_${event}`, title: `${clientName} ${event} your quote ${ref}`.trim(), link: '/quotes' }
    } else if (event === 'paid') {
      recipient = clientUserId
      payload = { type: 'job_paid', title: `${freelancerName} marked your job as paid`, body: ref ? `Receipt for ${ref}` : null, link: '/jobs' }
    } else if (event === 'completed') {
      if (isFreelancer) {
        recipient = clientUserId
        payload = { type: 'job_completed', title: `${freelancerName} marked the job complete`, link: '/jobs' }
      } else {
        recipient = freelancerUserId
        payload = { type: 'job_completed', title: `${clientName} marked the job complete`, link: '/quotes' }
      }
    }

    if (recipient && payload) {
      createNotification(recipient, payload)
      sendPushToUser(recipient, { title: payload.title, body: payload.body || '', url: payload.link }).catch(() => {})
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
