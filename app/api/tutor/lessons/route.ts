import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'

export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, end_time, duration_minutes, room, status, student_id, is_group, students(name), lesson_students(id, student_id, students(name))')
    .eq('tutor_id', tutor.tutorId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { date, start_time, duration_minutes, room, student_id, lesson_type, subject } = await req.json()

    if (!date || !start_time || !duration_minutes || !room || !student_id) {
      return NextResponse.json({ error: 'Brak wymaganych pól' }, { status: 400 })
    }

    const [h, m] = start_time.split(':').map(Number)
    const totalMinutes = h * 60 + m + duration_minutes
    const endH = Math.floor(totalMinutes / 60)
    const endM = totalMinutes % 60
    const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

    // Walidacja kolizji — sala zajęta w tym czasie?
    const newStart = h * 60 + m
    const newEnd = totalMinutes
    const { data: sameRoom } = await supabaseAdmin
      .from('lessons')
      .select('start_time, end_time')
      .eq('date', date)
      .eq('room', room)
    const toMin = (t: string) => { const [hh, mm] = String(t).split(':').map(Number); return hh * 60 + (mm || 0) }
    const conflict = (sameRoom ?? []).some(l => toMin(l.start_time) < newEnd && toMin(l.end_time) > newStart)
    if (conflict) {
      return NextResponse.json({ error: `${room} jest juz zajeta w tym czasie. Wybierz inna godzine lub sale.` }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('lessons')
      .insert({
        date,
        start_time,
        end_time,
        duration_minutes,
        room,
        student_id,
        tutor_id: tutor.tutorId,
        status: 'booked',
        is_group: false,
        payment_status: 'unpaid',
        lesson_type: lesson_type ?? null,
        subject: subject ?? null,
      })
      .select('id, date, start_time, end_time, duration_minutes, room, status, student_id, students(name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('lessons')
    .delete()
    .eq('id', id)
    .eq('tutor_id', tutor.tutorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
