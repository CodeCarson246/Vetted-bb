import { createClient } from '@supabase/supabase-js'

// Admin emails live in a server-only env var (comma-separated), so
// they are never shipped in the client bundle. The client page is
// just a UI shell — every privileged query and delete happens here,
// after the caller's JWT is verified.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

async function requireAdmin(request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { error: 'Server is not configured for admin access.', status: 500 }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { error: 'Not authenticated.', status: 401 }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: 'Not authenticated.', status: 401 }
  if (!adminEmails().includes((user.email || '').toLowerCase())) {
    return { error: 'Not authorized.', status: 403 }
  }
  return { supabase, user }
}

export async function GET(request) {
  const ctx = await requireAdmin(request)
  if (ctx.error) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { supabase } = ctx

  const [
    { count: freelancerCount },
    { count: clientCount },
    { count: reviewCount },
    { count: messageCount },
    { data: freelancers },
    { data: reviews },
    { data: messages },
  ] = await Promise.all([
    supabase.from('freelancers').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
    supabase.from('freelancers').select('id, name, trade, category, location, rating, created_at').order('created_at', { ascending: false }),
    supabase.from('reviews').select('id, author, comment, rating, type, date, created_at').order('created_at', { ascending: false }),
    supabase.from('messages').select('id, sender_name, sender_email, subject, created_at, read').order('created_at', { ascending: false }),
  ])

  return Response.json({
    stats: {
      freelancers: freelancerCount || 0,
      clients: clientCount || 0,
      reviews: reviewCount || 0,
      messages: messageCount || 0,
    },
    freelancers: freelancers || [],
    reviews: reviews || [],
    messages: messages || [],
  })
}

export async function DELETE(request) {
  const ctx = await requireAdmin(request)
  if (ctx.error) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { supabase } = ctx

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')
  if (!id || !['freelancer', 'review', 'message'].includes(type)) {
    return Response.json({ error: 'Invalid delete request.' }, { status: 400 })
  }

  if (type === 'freelancer') {
    // Child rows are removed by ON DELETE CASCADE (see SUPABASE_SQL.sql
    // section 2.3); explicit deletes kept as a fallback for databases
    // where the cascade migration hasn't run yet.
    await Promise.all([
      supabase.from('services').delete().eq('freelancer_id', id),
      supabase.from('reviews').delete().eq('freelancer_id', id),
      supabase.from('messages').delete().eq('freelancer_id', id),
      supabase.from('portfolio_items').delete().eq('freelancer_id', id),
    ])
    const { error } = await supabase.from('freelancers').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (type === 'review') {
    const { data: review } = await supabase.from('reviews').select('freelancer_id, type').eq('id', id).maybeSingle()
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Keep the freelancer's denormalized rating in sync
    if (review?.freelancer_id && review.type === 'client') {
      const { data: remaining } = await supabase
        .from('reviews')
        .select('rating')
        .eq('freelancer_id', review.freelancer_id)
        .eq('type', 'client')
      const count = remaining?.length || 0
      const avg = count > 0
        ? Math.round((remaining.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
        : 0
      await supabase.from('freelancers').update({ rating: avg, review_count: count }).eq('id', review.freelancer_id)
    }
    return Response.json({ success: true })
  }

  // type === 'message'
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
