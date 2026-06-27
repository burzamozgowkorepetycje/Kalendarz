import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lesson_id } = await req.json()
  if (!lesson_id) return NextResponse.json({ error: 'Brak lesson_id' }, { status: 400 })

  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('date, start_time, is_group, student_id, tutors(name, meet_link), students(name, phone), lesson_students(students(name, phone))')
    .eq('id', lesson_id)
    .single()

  if (!lesson) return NextResponse.json({ error: 'Nie znaleziono lekcji' }, { status: 404 })

  const tutor = lesson.tutors as unknown as { name: string; meet_link: string | null } | null
  const link = tutor?.meet_link
  if (!link) {
    return NextResponse.json({ error: 'Korepetytor nie ma ustawionego linku Google Meet (uzupełnij w profilu korepetytora).' }, { status: 400 })
  }

  const time = String(lesson.start_time).substring(0, 5)
  const date = new Date(lesson.date + 'T00:00:00').toLocaleDateString('pl-PL')
  const msg = `Zajecia online ${date} o ${time} z ${tutor.name}. Link: ${link}`

  // odbiorcy: uczeń indywidualny lub wszyscy z grupy
  const recipients: { phone: string | null }[] = []
  if (lesson.is_group) {
    for (const ls of (lesson.lesson_students as unknown as { students?: { phone: string | null } }[] | null) ?? []) {
      if (ls.students?.phone) recipients.push({ phone: ls.students.phone })
    }
  } else {
    const s = lesson.students as unknown as { phone: string | null } | null
    if (s?.phone) recipients.push({ phone: s.phone })
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Uczeń nie ma numeru telefonu do wysyłki SMS.' }, { status: 400 })
  }

  let ok = 0
  for (const r of recipients) {
    if (r.phone) {
      const res = await sendSMS(r.phone, msg)
      if (res.ok) ok++
    }
  }

  if (ok === 0) return NextResponse.json({ error: 'Nie udało się wysłać SMS-a.' }, { status: 502 })
  return NextResponse.json({ success: true, sent: ok })
}
