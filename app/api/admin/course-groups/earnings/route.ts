import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hasFinancialAccess } from '@/lib/auth'


// Realny zysk grup liczony z faktycznie odbytych/zaplanowanych zajęć w kalendarzu
// (a nie teoretycznie z listy zapisanych uczniów) — dla podanego zakresu dat.
export async function GET(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Tylko faktycznie odbyte zajęcia liczą się do zysku grupy — zajęcia odwołane
  // (status = 'cancelled') oraz te ręcznie wyłączone z rozliczeń (count_toward_earnings = false,
  // np. nieobecność korepetytora) są pomijane zarówno po stronie przychodu, jak i kosztu.
  let lessonsQuery = supabaseAdmin
    .from('lessons')
    .select('id, course_group_id, tutor_amount, count_toward_earnings, status')
    .not('course_group_id', 'is', null)
    .neq('status', 'cancelled')
  if (from) lessonsQuery = lessonsQuery.gte('date', from)
  if (to) lessonsQuery = lessonsQuery.lte('date', to)

  const { data: lessons, error: lessonsError } = await lessonsQuery
  if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 })
  if (!lessons || lessons.length === 0) return NextResponse.json([])

  // Zajęcia wyłączone z rozliczeń (count_toward_earnings = false) nie generują ani przychodu, ani kosztu.
  const countedLessons = lessons.filter(l => l.count_toward_earnings !== false)

  const lessonIds = countedLessons.map(l => l.id)
  const { data: lessonStudents, error: lsError } = lessonIds.length
    ? await supabaseAdmin
        .from('lesson_students')
        .select('lesson_id, amount_due')
        .in('lesson_id', lessonIds)
    : { data: [], error: null }
  if (lsError) return NextResponse.json({ error: lsError.message }, { status: 500 })

  const revenueByLesson = new Map<string, number>()
  for (const ls of lessonStudents || []) {
    revenueByLesson.set(ls.lesson_id, (revenueByLesson.get(ls.lesson_id) || 0) + (Number(ls.amount_due) || 0))
  }

  const byGroup = new Map<string, { lessonsCount: number; studentRevenue: number; tutorCost: number }>()
  for (const l of countedLessons) {
    const gid = l.course_group_id as string
    const entry = byGroup.get(gid) || { lessonsCount: 0, studentRevenue: 0, tutorCost: 0 }
    entry.lessonsCount += 1
    entry.studentRevenue += revenueByLesson.get(l.id) || 0
    entry.tutorCost += Number(l.tutor_amount) || 0
    byGroup.set(gid, entry)
  }

  return NextResponse.json(Array.from(byGroup.entries()).map(([course_group_id, v]) => ({ course_group_id, ...v })))
}
