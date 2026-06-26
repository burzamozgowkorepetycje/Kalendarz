import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReminderEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'

// Called daily by Vercel Cron at 20:00
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: lessons, error } = await supabaseAdmin
    .from('lessons')
    .select('*, tutors(name, email, phone), students(name, email, phone)')
    .eq('date', tomorrowStr)
    .eq('status', 'booked')
    .eq('reminder_sent', false)

  if (error || !lessons) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }

  let sent = 0
  for (const lesson of lessons) {
    const student = lesson.students
    const tutor = lesson.tutors
    if (!student || !tutor) continue

    const dateStr = new Date(lesson.date).toLocaleDateString('pl-PL')
    const time = String(lesson.start_time).slice(0, 5)

    // Email to student (pełna polszczyzna)
    if (student.email) {
      await sendReminderEmail(student.email, student.name, dateStr, lesson.start_time, tutor.name)
    }

    // SMS to student — bez polskich znaków (1 segment = tańszy SMS)
    if (student.phone) {
      await sendSMS(student.phone, `Przypomnienie: jutro o ${time} masz zajecia z ${tutor.name}. (${dateStr})`)
    }

    // SMS to tutor — bez polskich znaków
    if (tutor.phone) {
      await sendSMS(tutor.phone, `Przypomnienie: jutro o ${time} masz zajecia z ${student.name}.`)
    }

    await supabaseAdmin
      .from('lessons')
      .update({ reminder_sent: true })
      .eq('id', lesson.id)

    sent++
  }

  return NextResponse.json({ sent })
}
