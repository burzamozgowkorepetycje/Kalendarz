import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit, describeLesson } from '@/lib/audit'
import { findLessonConflicts } from '@/lib/conflicts'
import { availabilityWarnings } from '@/lib/availability'
import { getStaffRole, stripFinancialFields, stripFinancialFieldsDeep } from '@/lib/auth'
import { syncLessonCreate, syncLessonUpdate, syncLessonsDeleteMany } from '@/lib/googleCalendarSync'

// Hasło właściciela do wymuszenia mimo kolizji (sekretariat go nie zna).
// Domyślnie = hasło raportów; można nadpisać OWNER_PASSWORD w env.
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'admin1234'

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('student_id')
  const tutorId = searchParams.get('tutor_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const location = searchParams.get('location')

  let query = supabaseAdmin
    .from('lessons')
    .select('*, tutors(name, email, phone, meet_link), students(name, email, phone)')
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (studentId) query = query.eq('student_id', studentId)
  if (tutorId) query = query.eq('tutor_id', tutorId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (location) query = query.eq('location', location)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json()
  // Sekretariat nie może ustawiać kwot (amount_due / tutor_amount) — dane finansowe
  const body = role === 'admin' ? rawBody : stripFinancialFields(rawBody)
  const { date, start_time, end_time, duration_minutes } = body

  if (!date || !start_time || !end_time || !duration_minutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isOnline = body.location === 'Online'
  const room = isOnline ? null : (body.room || 'Sala 1')

  // Wykrywanie kolizji: sala (tylko stacjonarnie) + korepetytor + uczeń/grupa
  const conflicts = await findLessonConflicts({
    date, start_time, end_time, room,
    tutor_id: body.tutor_id || null,
    studentIds: Array.isArray(body.student_ids) ? body.student_ids : (body.student_id ? [body.student_id] : []),
  })
  if (conflicts.length > 0) {
    if (body.force === true) {
      // Wymuszenie tylko za poprawnym hasłem właściciela
      if (body.owner_password !== OWNER_PASSWORD) {
        return NextResponse.json({ error: 'Nieprawidłowe hasło właściciela', conflicts }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Wykryto kolizję', conflicts, canForce: true }, { status: 409 })
    }
  }

  // Miękkie ostrzeżenie o dostępności (można pominąć przez ack_warnings lub wymuszenie)
  if (body.force !== true && body.ack_warnings !== true) {
    const warnings = await availabilityWarnings({ tutor_id: body.tutor_id || null, date, start_time, end_time, subject: body.subject || null })
    if (warnings.length > 0) {
      return NextResponse.json({ warning: true, warnings }, { status: 409 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .insert({
      date, start_time, end_time, duration_minutes,
      tutor_id: body.tutor_id || null,
      student_id: body.student_id || null,
      amount_due: body.amount_due ?? null,
      tutor_amount: body.tutor_amount ?? null,
      room,
      location: body.location || 'Wyszków',
      is_group: body.is_group ?? false,
      lesson_type: body.lesson_type ?? null,
      subject: body.subject ?? null,
      series_id: body.series_id ?? null,
      course_group_id: body.course_group_id ?? null,
      count_toward_earnings: body.count_toward_earnings ?? true,
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

  // Synchronizacja z Google Calendar korepetytora — jeśli połączony. Nigdy nie rzuca,
  // więc nie wpływa na odpowiedź główną nawet jeśli Google Calendar zawiedzie.
  await syncLessonCreate(data)

  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function PUT(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, force, owner_password, student_ids, ack_warnings, ...rawFields } = await req.json()
  // Sekretariat nie może zmieniać kwot (amount_due / tutor_amount) — dane finansowe
  const fields = role === 'admin' ? rawFields : stripFinancialFields(rawFields)
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Walidacja kolizji przy zmianie terminu (sala opcjonalna — online nie ma sali)
  if (fields.date && fields.start_time && fields.end_time) {
    const conflicts = await findLessonConflicts({
      date: fields.date, start_time: fields.start_time, end_time: fields.end_time,
      room: fields.room || null, tutor_id: fields.tutor_id || null,
      studentIds: Array.isArray(student_ids) ? student_ids : (fields.student_id ? [fields.student_id] : []),
      excludeId: id,
    })
    if (conflicts.length > 0) {
      if (force === true) {
        if (owner_password !== OWNER_PASSWORD) {
          return NextResponse.json({ error: 'Nieprawidłowe hasło właściciela', conflicts }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Wykryto kolizję', conflicts, canForce: true }, { status: 409 })
      }
    }

    // Miękkie ostrzeżenie o dostępności
    if (force !== true && ack_warnings !== true) {
      const warnings = await availabilityWarnings({ tutor_id: fields.tutor_id || null, date: fields.date, start_time: fields.start_time, end_time: fields.end_time, subject: fields.subject || null })
      if (warnings.length > 0) {
        return NextResponse.json({ warning: true, warnings }, { status: 409 })
      }
    }
  }

  // pobierz starą kwotę wynagrodzenia (do audytu zmiany)
  let oldTutorAmount: number | null = null
  if ('tutor_amount' in fields) {
    const { data: prev } = await supabaseAdmin.from('lessons').select('tutor_amount').eq('id', id).single()
    oldTutorAmount = prev?.tutor_amount ?? null
  }

  // pobierz poprzedniego korepetytora (do synchronizacji Google Calendar — jeśli zmieniamy
  // korepetytora, trzeba usunąć wydarzenie u starego i utworzyć u nowego)
  const { data: prevLesson } = await supabaseAdmin.from('lessons').select('tutor_id').eq('id', id).single()
  const previousTutorId: string | null = prevLesson?.tutor_id ?? null

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const label = await describeLesson(data)

  // Osobny wpis w historii dla zmiany kwoty wynagrodzenia korepetytora
  if ('tutor_amount' in fields) {
    const newAmount = data.tutor_amount ?? null
    if (Number(oldTutorAmount) !== Number(newAmount)) {
      await logAudit({
        actor_type: 'admin', actor_name: 'Administracja', action: 'update',
        summary: `Zmiana wynagrodzenia korepetytora: ${oldTutorAmount ?? '—'} zł → ${newAmount ?? '—'} zł (${label})`,
      })
    }
  }

  await logAudit({
    actor_type: 'admin', actor_name: 'Administracja', action: 'update',
    summary: `Edytowano zajęcia: ${label}`,
  })

  // Synchronizacja z Google Calendar — aktualizuje/przenosi/tworzy wydarzenie w razie
  // potrzeby. Nigdy nie rzuca, więc błąd Google nie wpływa na tę odpowiedź.
  await syncLessonUpdate(data, previousTutorId)

  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function DELETE(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Korepetytorzy usuwanych zajęć (do synchronizacji Google Calendar — musimy to wiedzieć
  // przed usunięciem wierszy z bazy, żeby nie zostawić osieroconych wydarzeń w Google).
  const { data: lessonsForSync } = await supabaseAdmin
    .from('lessons')
    .select('id, tutor_id')
    .in('id', targetIds)
  const tutorIdByLesson = new Map<string, string | null>(
    (lessonsForSync ?? []).map((l) => [l.id as string, (l.tutor_id as string | null) ?? null])
  )

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

  // Synchronizacja: usuń odpowiadające wydarzenia w Google Calendar (nigdy nie rzuca).
  await syncLessonsDeleteMany(targetIds, tutorIdByLesson)

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
