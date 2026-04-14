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
    .from('availability_blocks')
    .select('*')
    .eq('freelancer_id', freelancerId)
    .order('start_time', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data || [] })
}

export async function POST(request) {
  const body = await request.json()

  const { data, error } = await sb()
    .from('availability_blocks')
    .insert(body)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data }, { status: 201 })
}
