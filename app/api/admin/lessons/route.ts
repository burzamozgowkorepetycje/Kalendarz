import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
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
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  // Usuń powiązanych uczniów grupowych, potem lekcje
  await supabaseAdmin.from('lesson_students').delete().in('lesson_id', targetIds)
  const { error } = await supabaseAdmin.from('lessons').delete().in('id', targetIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
