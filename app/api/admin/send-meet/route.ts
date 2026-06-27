import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMeetEmail } from '@/lib/email'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lesson_id } = await req.json()
  if (!lesson_id) return NextResponse.json({ error: 'Brak lesson_id' }, { status: 400 })

  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('date, start_time, is_group, student_id, tutors(name, meet_link), students(name, email), lesson_students(students(name, email))')
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

  const recipients: { name: string; email: string }[] = []
  if (lesson.is_group) {
    for (const ls of (lesson.lesson_students as unknown as { students?: { name: string; email: string | null } }[] | null) ?? []) {
      if (ls.students?.email) recipients.push({ name: ls.students.name, email: ls.students.email })
    }
  } else {
    const s = lesson.students as unknown as { name: string; email: string | null } | null
    if (s?.email) recipients.push({ name: s.name, email: s.email })
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Uczeń nie ma adresu email do wysyłki linku.' }, { status: 400 })
  }

  let ok = 0
  let lastErr = ''
  for (const r of recipients) {
    const res = await sendMeetEmail(r.email, r.name, tutor.name, date, time, link)
    if (res.ok) ok++
    else lastErr = res.error || 'błąd'
  }

  if (ok === 0) return NextResponse.json({ error: `Nie wysłano: ${lastErr}` }, { status: 502 })
  return NextResponse.json({ success: true, sent: ok })
}
