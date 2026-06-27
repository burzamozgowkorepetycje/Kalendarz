import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'

export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Brak daty' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, end_time, duration_minutes, room, status, is_group, tutor_id, student_id, tutor_amount, tutors(name), students(name)')
    .eq('date', date)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lessons: data, tutorId: tutor.tutorId })
}
