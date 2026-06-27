import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'
import { logAudit, describeLesson } from '@/lib/audit'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// GET — lista lekcji do uzupełnienia obecności (dziś + zaległe, nie odwołane, nie uzupełnione)
export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = todayStr()

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, end_time, room, subject, lesson_type, is_group, student_id, attendance_submitted, students(name), lesson_students(student_id, attendance, students(name))')
    .eq('tutor_id', tutor.tutorId)
    .neq('status', 'cancelled')
    .in('status', ['booked', 'completed'])
    .lte('date', today)
    .eq('attendance_submitted', false)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pending = data ?? []
  const hasOverdue = pending.some(l => l.date < today)

  return NextResponse.json({ pending, count: pending.length, hasOverdue })
}

// POST — zapis obecności
export async function POST(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lesson_id, status, group, note } = await req.json()
  if (!lesson_id) return NextResponse.json({ error: 'Brak lesson_id' }, { status: 400 })

  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, room, student_id, is_group, status, attendance_submitted, attendance_submitted_at')
    .eq('id', lesson_id)
    .eq('tutor_id', tutor.tutorId)
    .single()

  if (!lesson) return NextResponse.json({ error: 'Nie znaleziono lekcji' }, { status: 404 })
  if (lesson.status === 'cancelled') {
    return NextResponse.json({ error: 'Lekcja została odwołana przez administrację' }, { status: 400 })
  }

  // Blokada edycji po końcu dnia — korepetytor edytuje tylko tego samego dnia
  if (lesson.attendance_submitted && lesson.attendance_submitted_at) {
    const submittedDay = String(lesson.attendance_submitted_at).split('T')[0]
    if (submittedDay !== todayStr()) {
      return NextResponse.json(
        { error: 'Obecność można edytować tylko w dniu uzupełnienia. Zmiany może wprowadzić administracja.' },
        { status: 403 }
      )
    }
  }

  if (lesson.is_group) {
    if (!Array.isArray(group) || group.length === 0) {
      return NextResponse.json({ error: 'Brak statusów uczniów' }, { status: 400 })
    }
    for (const g of group) {
      if (!['present', 'absent', 'na'].includes(g.status)) {
        return NextResponse.json({ error: 'Nieprawidłowy status ucznia' }, { status: 400 })
      }
    }
  } else {
    if (!['present', 'absent', 'not_held'].includes(status)) {
      return NextResponse.json({ error: 'Nieprawidłowy status' }, { status: 400 })
    }
    if (status === 'not_held' && !String(note || '').trim()) {
      return NextResponse.json({ error: 'Przy statusie „nie odbyła się” notatka jest wymagana' }, { status: 400 })
    }
  }

  // Domyślnie: „nie odbyła się" → NIE liczy się do zarobków (dopóki admin nie zmieni)
  const earningsUpdate = (!lesson.is_group && status === 'not_held') ? { count_toward_earnings: false } : {}

  // Zapis na lekcji
  const { error: updErr } = await supabaseAdmin
    .from('lessons')
    .update({
      attendance_submitted: true,
      attendance_submitted_by: tutor.name,
      attendance_submitted_at: new Date().toISOString(),
      attendance_note: note ? String(note).trim() : null,
      attendance_status: lesson.is_group ? null : status,
      attendance_reviewed: false,
      ...earningsUpdate,
    })
    .eq('id', lesson_id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Zapis per uczeń (grupa)
  if (lesson.is_group) {
    for (const g of group) {
      await supabaseAdmin
        .from('lesson_students')
        .update({ attendance: g.status })
        .eq('lesson_id', lesson_id)
        .eq('student_id', g.student_id)
    }
  }

  const label = await describeLesson(lesson)
  const statusLabel = lesson.is_group
    ? 'grupa'
    : status === 'present' ? 'obecny' : status === 'absent' ? 'nieobecny' : 'nie odbyła się — do wyjaśnienia'
  await logAudit({
    actor_type: 'tutor', actor_name: tutor.name, action: 'update',
    summary: `Uzupełniono obecność (${statusLabel}): ${label}`,
  })

  return NextResponse.json({ success: true })
}
