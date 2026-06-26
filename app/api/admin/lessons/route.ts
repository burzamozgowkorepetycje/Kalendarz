import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit, describeLesson } from '@/lib/audit'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

function toMin(t: string | null): number {
  if (!t) return 0
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Sprawdza czy w danej sali i dniu nowy przedział [start,end) nachodzi na istniejące zajęcia.
 * excludeId — pomija lekcję o tym id (przy edycji).
 */
async function hasRoomConflict(date: string, room: string, start: string, end: string, excludeId?: string): Promise<boolean> {
  const newStart = toMin(start)
  const newEnd = toMin(end)
  let q = supabaseAdmin
    .from('lessons')
    .select('id, start_time, end_time')
    .eq('date', date)
    .eq('room', room)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q
  return (data ?? []).some(l => toMin(l.start_time) < newEnd && toMin(l.end_time) > newStart)
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('student_id')
  const tutorId = searchParams.get('tutor_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('lessons')
    .select('*, tutors(name, email, phone), students(name, email, phone)')
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (studentId) query = query.eq('student_id', studentId)
  if (tutorId) query = query.eq('tutor_id', tutorId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, start_time, end_time, duration_minutes } = body

  if (!date || !start_time || !end_time || !duration_minutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const room = body.room || 'Sala 1'
  if (await hasRoomConflict(date, room, start_time, end_time)) {
    return NextResponse.json(
      { error: `${room} jest już zajęta w tym czasie (${date}). Wybierz inną godzinę lub salę.` },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .insert({
      date, start_time, end_time, duration_minutes,
      tutor_id: body.tutor_id || null,
      student_id: body.student_id || null,
      amount_due: body.amount_due ?? null,
      tutor_amount: body.tutor_amount ?? null,
      room: body.room || 'Sala 1',
      is_group: body.is_group ?? false,
      lesson_type: body.lesson_type ?? null,
      subject: body.subject ?? null,
      series_id: body.series_id ?? null,
      status: body.status || (body.tutor_id ? 'booked' : 'available'),
      payment_status: 'unpaid',
      reminder_sent: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor_type: 'admin', actor_name: 'Administracja', action: 'create',
    summary: `Dodano zajęcia: ${await describeLesson(data)}`,
  })

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Walidacja kolizji przy zmianie terminu (jeśli przekazano date/room/godziny)
  if (fields.date && fields.room && fields.start_time && fields.end_time) {
    if (await hasRoomConflict(fields.date, fields.room, fields.start_time, fields.end_time, id)) {
      return NextResponse.json(
        { error: `${fields.room} jest już zajęta w tym czasie (${fields.date}). Wybierz inną godzinę lub salę.` },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor_type: 'admin', actor_name: 'Administracja', action: 'update',
    summary: `Edytowano zajęcia: ${await describeLesson(data)}`,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const credit = searchParams.get('credit') === 'true'
  // zakres usuwania w obrębie cyklu: 'this' (domyślnie) | 'future' | 'all'
  const scope = searchParams.get('scope') || 'this'
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Pobierz lekcję wskazaną (potrzebny series_id i date do zakresu)
  const { data: target } = await supabaseAdmin
    .from('lessons')
    .select('id, date, series_id')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  // Wyznacz listę lekcji do usunięcia
  let targetIds: string[] = [id]
  if (scope !== 'this' && target.series_id) {
    let q = supabaseAdmin
      .from('lessons')
      .select('id')
      .eq('series_id', target.series_id)
    if (scope === 'future') q = q.gte('date', target.date)
    const { data: seriesLessons } = await q
    targetIds = (seriesLessons ?? []).map(l => l.id as string)
    if (targetIds.length === 0) targetIds = [id]
  }

  // Opcjonalnie: dolicz kwoty do salda kredytu uczniów (nadpłata)
  if (credit) {
    const { data: lessonsToCredit } = await supabaseAdmin
      .from('lessons')
      .select('id, student_id, amount_due, is_group')
      .in('id', targetIds)

    for (const lesson of lessonsToCredit ?? []) {
      if (lesson.is_group) {
        const { data: ls } = await supabaseAdmin
          .from('lesson_students')
          .select('student_id, amount_due')
          .eq('lesson_id', lesson.id)
        for (const entry of ls ?? []) {
          await addCredit(entry.student_id as string, Number(entry.amount_due) || 0)
        }
      } else if (lesson.student_id) {
        await addCredit(lesson.student_id as string, Number(lesson.amount_due) || 0)
      }
    }
  }

  // Opis do historii (dopóki lekcja jeszcze istnieje)
  const { data: labelLesson } = await supabaseAdmin
    .from('lessons')
    .select('date, start_time, room, student_id, is_group')
    .eq('id', id)
    .single()
  const label = labelLesson ? await describeLesson(labelLesson) : ''

  // Usuń powiązanych uczniów grupowych, potem lekcje
  await supabaseAdmin.from('lesson_students').delete().in('lesson_id', targetIds)
  const { error } = await supabaseAdmin.from('lessons').delete().in('id', targetIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor_type: 'admin', actor_name: 'Administracja', action: 'delete',
    summary: targetIds.length > 1
      ? `Usunięto ${targetIds.length} zajęć z cyklu (od: ${label})`
      : `Usunięto zajęcia: ${label}`,
  })

  return NextResponse.json({ success: true, deleted: targetIds.length })
}

async function addCredit(studentId: string, amount: number) {
  if (!studentId || amount <= 0) return
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('credit_balance')
    .eq('id', studentId)
    .single()
  const current = Number(student?.credit_balance) || 0
  await supabaseAdmin
    .from('students')
    .update({ credit_balance: +(current + amount).toFixed(2) })
    .eq('id', studentId)
}
