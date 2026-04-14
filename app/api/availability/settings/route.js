import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const freelancerId = searchParams.get('freelancer_id')
  if (!freelancerId) return Response.json({ error: 'freelancer_id required' }, { status: 400 })

  const { data, error } = await sb()
    .from('availability_settings')
    .select('*')
    .eq('freelancer_id', freelancerId)
    .single()

  // PGRST116 = no rows found — not an error, just means upsert hasn't run yet
  if (error && error.code !== 'PGRST116')
    return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ data: data || null })
}

export async function PATCH(request) {
  const body = await request.json()
  const { freelancer_id, ...patch } = body

  const { data, error } = await sb()
    .from('availability_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('freelancer_id', freelancer_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}
