import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

interface Slot { weekday: number; start_time: string; end_time: string }

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tutorId = new URL(req.url).searchParams.get('tutor_id')

  // bez tutor_id → zwróć wszystkich (do siatki online)
  let q = supabaseAdmin
    .from('tutor_availability')
    .select(tutorId ? 'weekday, start_time, end_time' : 'tutor_id, weekday, start_time, end_time')
    .order('weekday', { ascending: true })
  if (tutorId) q = q.eq('tutor_id', tutorId)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tutor_id, slots } = (await req.json()) as { tutor_id: string; slots: Slot[] }
  if (!tutor_id) return NextResponse.json({ error: 'Missing tutor_id' }, { status: 400 })

  await supabaseAdmin.from('tutor_availability').delete().eq('tutor_id', tutor_id)

  const rows = (slots ?? [])
    .filter(s => s.start_time && s.end_time)
    .map(s => ({ tutor_id, weekday: s.weekday, start_time: s.start_time, end_time: s.end_time }))

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('tutor_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
