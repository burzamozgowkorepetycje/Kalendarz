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
  const { date, start_time, end_time, duration_minutes, tutor_id, student_id, amount_due, room } = body

  if (!date || !start_time || !end_time || !duration_minutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .insert({
      date, start_time, end_time, duration_minutes,
      tutor_id: tutor_id || null,
      student_id: student_id || null,
      amount_due: amount_due || null,
      room: room || 'Sala 1',
      status: tutor_id && student_id ? 'booked' : 'available',
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
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Opcjonalnie: dolicz kwotę lekcji do salda kredytu ucznia (nadpłata)
  if (credit) {
    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('student_id, amount_due, is_group')
      .eq('id', id)
      .single()

    if (lesson?.is_group) {
      // grupowe — każdy uczeń dostaje swój kredyt
      const { data: ls } = await supabaseAdmin
        .from('lesson_students')
        .select('student_id, amount_due')
        .eq('lesson_id', id)
      for (const entry of ls ?? []) {
        await addCredit(entry.student_id as string, Number(entry.amount_due) || 0)
      }
    } else if (lesson?.student_id) {
      await addCredit(lesson.student_id as string, Number(lesson.amount_due) || 0)
    }
  }

  const { error } = await supabaseAdmin.from('lessons').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
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
