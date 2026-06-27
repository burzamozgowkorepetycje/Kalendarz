import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'

// kategoria: kurs / grupowe / indywidualne
function category(lesson: { lesson_type: string | null; is_group: boolean }): 'course' | 'group' | 'individual' {
  if (lesson.lesson_type === 'Kursy maturalne') return 'course'
  if (lesson.is_group) return 'group'
  return 'individual'
}

export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || '2000-01-01'
  const to = searchParams.get('to') || '2099-12-31'

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, end_time, duration_minutes, room, subject, lesson_type, is_group, attendance_status, attendance_note, tutor_amount, students(name), lesson_students(attendance, students(name))')
    .eq('tutor_id', tutor.tutorId)
    .eq('count_toward_earnings', true)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lessons = data ?? []
  let minutes = 0
  let total = 0
  let individual = 0
  let group = 0
  let course = 0

  for (const l of lessons) {
    minutes += l.duration_minutes || 0
    total += Number(l.tutor_amount) || 0
    const cat = category(l)
    if (cat === 'course') course++
    else if (cat === 'group') group++
    else individual++
  }

  // policz nieuzupełnione obecności (dziś + zaległe), by ostrzec
  const today = new Date().toISOString().split('T')[0]
  const { count: pendingAttendance } = await supabaseAdmin
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('tutor_id', tutor.tutorId)
    .neq('status', 'cancelled')
    .in('status', ['booked', 'completed'])
    .lte('date', today)
    .eq('attendance_submitted', false)

  return NextResponse.json({
    lessons,
    summary: {
      hours: +(minutes / 60).toFixed(1),
      lessons: lessons.length,
      individual,
      group,
      course,
      total: +total.toFixed(2),
    },
    pendingAttendance: pendingAttendance || 0,
  })
}
