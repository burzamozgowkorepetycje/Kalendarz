import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit, describeLesson } from '@/lib/audit'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

async function addCredit(studentId: string, amount: number) {
  if (!studentId || amount <= 0) return
  const { data: s } = await supabaseAdmin.from('students').select('credit_balance').eq('id', studentId).single()
  const current = Number(s?.credit_balance) || 0
  await supabaseAdmin.from('students').update({ credit_balance: +(current + amount).toFixed(2) }).eq('id', studentId)
}

// GET — lekcje wymagające uwagi administracji
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('*, tutors(name), students(name), lesson_students(student_id, attendance, students(name))')
    .eq('attendance_submitted', true)
    .eq('attendance_reviewed', false)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pokazuj tylko te, które wymagają uwagi: nieobecność / nie odbyła się / notatka / problem w grupie
  const flagged = (data ?? []).filter(l => {
    if (l.attendance_status === 'absent' || l.attendance_status === 'not_held') return true
    if (l.attendance_note) return true
    const ls = (l.lesson_students as unknown as { attendance: string | null }[] | null) ?? []
    if (ls.some(s => s.attendance === 'absent' || s.attendance === 'na')) return true
    return false
  })

  return NextResponse.json(flagged)
}

// POST — decyzja administracji
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lesson_id, action } = await req.json()
  if (!lesson_id || !action) return NextResponse.json({ error: 'Brak danych' }, { status: 400 })

  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('id, date, start_time, room, student_id, amount_due, is_group')
    .eq('id', lesson_id)
    .single()
  if (!lesson) return NextResponse.json({ error: 'Nie znaleziono lekcji' }, { status: 404 })

  const label = await describeLesson(lesson)
  let summary = ''

  switch (action) {
    case 'paid':
      await supabaseAdmin.from('lessons').update({ payment_status: 'paid', attendance_reviewed: true }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — oznaczono jako płatną: ${label}`
      break
    case 'unpaid':
      await supabaseAdmin.from('lessons').update({ payment_status: 'unpaid', attendance_reviewed: true }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — oznaczono jako niepłatną: ${label}`
      break
    case 'credit':
      if (lesson.is_group) {
        const { data: ls } = await supabaseAdmin.from('lesson_students').select('student_id, amount_due').eq('lesson_id', lesson_id)
        for (const e of ls ?? []) await addCredit(e.student_id as string, Number(e.amount_due) || 0)
      } else if (lesson.student_id) {
        await addCredit(lesson.student_id as string, Number(lesson.amount_due) || 0)
      }
      await supabaseAdmin.from('lessons').update({ payment_status: 'paid', attendance_reviewed: true }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — dodano kredyt uczniowi: ${label}`
      break
    case 'makeup':
      await supabaseAdmin.from('lessons').update({ needs_makeup: true, attendance_reviewed: true }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — oznaczono do odrobienia: ${label}`
      break
    case 'cancel':
      await supabaseAdmin.from('lessons').update({ status: 'cancelled', attendance_reviewed: true, count_toward_earnings: false }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — lekcja anulowana: ${label}`
      break
    case 'dismiss':
      await supabaseAdmin.from('lessons').update({ attendance_reviewed: true }).eq('id', lesson_id)
      summary = `Obecność rozpatrzona — bez zmian: ${label}`
      break
    default:
      return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  }

  await logAudit({ actor_type: 'admin', actor_name: 'Administracja', action: 'update', summary })
  return NextResponse.json({ success: true })
}
