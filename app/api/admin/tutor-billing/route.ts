import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hasFinancialAccess } from '@/lib/auth'


// Miesięczne rozliczenie korepetytorów per grupa i przedmiot.
// Liczone WYŁĄCZNIE z faktycznie odbytych zajęć: pomija status = 'cancelled'
// oraz zajęcia ręcznie wyłączone z rozliczeń (count_toward_earnings = false).
export async function GET(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || '2000-01-01'
  const to = searchParams.get('to') || '2099-12-31'

  const { data: lessons, error } = await supabaseAdmin
    .from('lessons')
    .select(
      'id, date, tutor_id, tutor_amount, duration_minutes, subject, is_group, course_group_id, count_toward_earnings, status, tutors(name), course_groups(name)'
    )
    .gte('date', from)
    .lte('date', to)
    .neq('status', 'cancelled')
    .not('tutor_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    month: string
    tutor_id: string
    tutor_name: string
    course_group_id: string | null
    group_name: string
    subject: string
    lessons: number
    hours: number
    tutor_amount: number
  }

  const map = new Map<string, Row>()

  for (const l of lessons ?? []) {
    // zajęcia ręcznie wyłączone z rozliczeń (np. nieobecność korepetytora) nie liczą się do wypłaty
    if (l.count_toward_earnings === false) continue

    const month = (l.date as string).slice(0, 7) // YYYY-MM
    const tutorId = l.tutor_id as string
    const tutorName = (l.tutors as unknown as { name: string } | null)?.name ?? 'Nieznany'
    const groupId = l.course_group_id as string | null
    const groupName = (l.course_groups as unknown as { name: string } | null)?.name ?? (l.is_group ? 'Grupa (bez przypisania)' : 'Zajęcia indywidualne')
    const subject = l.subject || 'Brak przedmiotu'

    const key = `${month}|${tutorId}|${groupId ?? 'none'}|${subject}`
    const entry = map.get(key) || {
      month,
      tutor_id: tutorId,
      tutor_name: tutorName,
      course_group_id: groupId,
      group_name: groupName,
      subject,
      lessons: 0,
      hours: 0,
      tutor_amount: 0,
    }
    entry.lessons += 1
    entry.hours += (l.duration_minutes || 0) / 60
    entry.tutor_amount += Number(l.tutor_amount) || 0
    map.set(key, entry)
  }

  const rows = Array.from(map.values())
    .map(r => ({ ...r, hours: +r.hours.toFixed(2), tutor_amount: +r.tutor_amount.toFixed(2) }))
    .sort((a, b) => (a.month === b.month ? a.tutor_name.localeCompare(b.tutor_name) : b.month.localeCompare(a.month)))

  // podsumowanie per korepetytor per miesiąc (suma po grupach/przedmiotach)
  const tutorMonthMap = new Map<string, { month: string; tutor_id: string; tutor_name: string; tutor_amount: number }>()
  for (const r of rows) {
    const key = `${r.month}|${r.tutor_id}`
    const entry = tutorMonthMap.get(key) || { month: r.month, tutor_id: r.tutor_id, tutor_name: r.tutor_name, tutor_amount: 0 }
    entry.tutor_amount += r.tutor_amount
    tutorMonthMap.set(key, entry)
  }
  const tutorMonthTotals = Array.from(tutorMonthMap.values())
    .map(v => ({ ...v, tutor_amount: +v.tutor_amount.toFixed(2) }))
    .sort((a, b) => (a.month === b.month ? a.tutor_name.localeCompare(b.tutor_name) : b.month.localeCompare(a.month)))

  return NextResponse.json({ rows, tutorMonthTotals })
}
