import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'

interface Slot { weekday: number; start_time: string; end_time: string }

export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('tutor_availability')
    .select('weekday, start_time, end_time')
    .eq('tutor_id', tutor.tutorId)
    .order('weekday', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slots } = (await req.json()) as { slots: Slot[] }

  // pełne zastąpienie grafiku
  await supabaseAdmin.from('tutor_availability').delete().eq('tutor_id', tutor.tutorId)

  const rows = (slots ?? [])
    .filter(s => s.start_time && s.end_time)
    .map(s => ({ tutor_id: tutor.tutorId, weekday: s.weekday, start_time: s.start_time, end_time: s.end_time }))

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('tutor_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
