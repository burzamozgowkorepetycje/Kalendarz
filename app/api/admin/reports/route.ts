import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || '2000-01-01'
  const to = searchParams.get('to') || '2099-12-31'
  const paidOnly = searchParams.get('paid_only') === 'true'

  // Fetch all lessons in range with joins
  let query = supabaseAdmin
    .from('lessons')
    .select('id, tutor_id, student_id, duration_minutes, amount_due, tutor_amount, payment_status, status, is_group, lesson_type, subject, tutors(name), students(name, email, phone)')
    .gte('date', from)
    .lte('date', to)
    .in('status', ['booked', 'completed'])

  if (paidOnly) query = query.eq('payment_status', 'paid')

  const { data: lessons, error: lessonsError } = await query
  if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 })

  // Fetch group lesson students
  const { data: groupStudents, error: gsError } = await supabaseAdmin
    .from('lesson_students')
    .select('lesson_id, student_id, amount_due, payment_status, students(name, email, phone), lessons!inner(date, status, tutor_id, tutor_amount, duration_minutes, lesson_type, subject, tutors(name))')
    .gte('lessons.date', from)
    .lte('lessons.date', to)
    .in('lessons.status', ['booked', 'completed'])

  if (gsError) return NextResponse.json({ error: gsError.message }, { status: 500 })

  // --- SUMMARY ---
  let totalRevenue = 0
  let totalCost = 0

  // individual lessons
  for (const l of lessons ?? []) {
    if (l.is_group) continue
    if (paidOnly && l.payment_status !== 'paid') continue
    totalRevenue += l.amount_due ?? 0
    totalCost += l.tutor_amount ?? 0
  }
  // group lessons — revenue from lesson_students, cost from lesson
  const groupLessonCostCounted = new Set<string>()
  for (const gs of groupStudents ?? []) {
    if (paidOnly && gs.payment_status !== 'paid') continue
    totalRevenue += gs.amount_due ?? 0
    // cost counted once per lesson
    const lesson = gs.lessons as unknown as { tutor_amount: number | null; id?: string }
    const lessonId = gs.lesson_id as string
    if (!groupLessonCostCounted.has(lessonId)) {
      totalCost += lesson?.tutor_amount ?? 0
      groupLessonCostCounted.add(lessonId)
    }
  }

  // --- PER TUTOR ---
  const tutorMap: Record<string, { name: string; minutes: number; revenue: number; cost: number; costCounted: Set<string> }> = {}

  const ensureTutor = (id: string, name: string) => {
    if (!tutorMap[id]) tutorMap[id] = { name, minutes: 0, revenue: 0, cost: 0, costCounted: new Set() }
  }

  for (const l of lessons ?? []) {
    if (!l.tutor_id) continue
    if (l.is_group) continue
    if (paidOnly && l.payment_status !== 'paid') continue
    const tutor = l.tutors as unknown as { name: string } | null
    ensureTutor(l.tutor_id as string, tutor?.name ?? 'Nieznany')
    const t = tutorMap[l.tutor_id as string]
    t.minutes += l.duration_minutes
    t.revenue += l.amount_due ?? 0
    t.cost += l.tutor_amount ?? 0
  }

  for (const gs of groupStudents ?? []) {
    if (paidOnly && gs.payment_status !== 'paid') continue
    const lesson = gs.lessons as unknown as { tutor_id: string | null; tutor_amount: number | null; duration_minutes: number; tutors: { name: string } | null }
    if (!lesson?.tutor_id) continue
    const lessonId = gs.lesson_id as string
    ensureTutor(lesson.tutor_id, lesson.tutors?.name ?? 'Nieznany')
    const t = tutorMap[lesson.tutor_id]
    t.revenue += gs.amount_due ?? 0
    if (!t.costCounted.has(lessonId)) {
      t.cost += lesson.tutor_amount ?? 0
      t.minutes += lesson.duration_minutes
      t.costCounted.add(lessonId)
    }
  }

  const tutors = Object.entries(tutorMap).map(([id, v]) => ({
    tutor_id: id,
    name: v.name,
    hours: +(v.minutes / 60).toFixed(2),
    revenue: +v.revenue.toFixed(2),
    cost: +v.cost.toFixed(2),
    profit: +(v.revenue - v.cost).toFixed(2),
  })).sort((a, b) => b.profit - a.profit)

  // --- PER LESSON TYPE ---
  const typeMap: Record<string, { revenue: number; cost: number; costCounted: Set<string> }> = {}

  const ensureType = (key: string) => {
    if (!typeMap[key]) typeMap[key] = { revenue: 0, cost: 0, costCounted: new Set() }
  }

  for (const l of lessons ?? []) {
    if (l.is_group) continue
    if (paidOnly && l.payment_status !== 'paid') continue
    const key = l.lesson_type || 'Brak tagu'
    ensureType(key)
    typeMap[key].revenue += l.amount_due ?? 0
    typeMap[key].cost += l.tutor_amount ?? 0
  }

  for (const gs of groupStudents ?? []) {
    if (paidOnly && gs.payment_status !== 'paid') continue
    const lesson = gs.lessons as unknown as { tutor_amount: number | null; lesson_type: string | null }
    const key = lesson?.lesson_type || 'Brak tagu'
    const lessonId = gs.lesson_id as string
    ensureType(key)
    typeMap[key].revenue += gs.amount_due ?? 0
    if (!typeMap[key].costCounted.has(lessonId)) {
      typeMap[key].cost += lesson?.tutor_amount ?? 0
      typeMap[key].costCounted.add(lessonId)
    }
  }

  const byType = Object.entries(typeMap).map(([type, v]) => ({
    type,
    revenue: +v.revenue.toFixed(2),
    cost: +v.cost.toFixed(2),
    profit: +(v.revenue - v.cost).toFixed(2),
  })).sort((a, b) => b.profit - a.profit)

  // --- PER SUBJECT ---
  const subjectMap: Record<string, { revenue: number; cost: number; costCounted: Set<string> }> = {}

  const ensureSubject = (key: string) => {
    if (!subjectMap[key]) subjectMap[key] = { revenue: 0, cost: 0, costCounted: new Set() }
  }

  for (const l of lessons ?? []) {
    if (l.is_group) continue
    if (paidOnly && l.payment_status !== 'paid') continue
    const key = l.subject || 'Brak przedmiotu'
    ensureSubject(key)
    subjectMap[key].revenue += l.amount_due ?? 0
    subjectMap[key].cost += l.tutor_amount ?? 0
  }

  for (const gs of groupStudents ?? []) {
    if (paidOnly && gs.payment_status !== 'paid') continue
    const lesson = gs.lessons as unknown as { tutor_amount: number | null; subject: string | null }
    const key = lesson?.subject || 'Brak przedmiotu'
    const lessonId = gs.lesson_id as string
    ensureSubject(key)
    subjectMap[key].revenue += gs.amount_due ?? 0
    if (!subjectMap[key].costCounted.has(lessonId)) {
      subjectMap[key].cost += lesson?.tutor_amount ?? 0
      subjectMap[key].costCounted.add(lessonId)
    }
  }

  const bySubject = Object.entries(subjectMap).map(([subject, v]) => ({
    subject,
    revenue: +v.revenue.toFixed(2),
    cost: +v.cost.toFixed(2),
    profit: +(v.revenue - v.cost).toFixed(2),
  })).sort((a, b) => b.profit - a.profit)

  // --- PER STUDENT payments ---
  const studentMap: Record<string, { name: string; email: string | null; phone: string | null; total_due: number; total_paid: number }> = {}

  const ensureStudent = (id: string, s: { name: string; email?: string | null; phone?: string | null } | null) => {
    if (!studentMap[id]) studentMap[id] = { name: s?.name ?? 'Nieznany', email: s?.email ?? null, phone: s?.phone ?? null, total_due: 0, total_paid: 0 }
  }

  for (const l of lessons ?? []) {
    if (l.is_group || !l.student_id) continue
    const s = l.students as unknown as { name: string; email?: string | null; phone?: string | null } | null
    ensureStudent(l.student_id as string, s)
    studentMap[l.student_id as string].total_due += l.amount_due ?? 0
    if (l.payment_status === 'paid') studentMap[l.student_id as string].total_paid += l.amount_due ?? 0
  }

  for (const gs of groupStudents ?? []) {
    const s = gs.students as unknown as { name: string; email?: string | null; phone?: string | null } | null
    ensureStudent(gs.student_id as string, s)
    studentMap[gs.student_id as string].total_due += gs.amount_due ?? 0
    if (gs.payment_status === 'paid') studentMap[gs.student_id as string].total_paid += gs.amount_due ?? 0
  }

  const students = Object.entries(studentMap).map(([id, v]) => ({
    student_id: id,
    name: v.name,
    email: v.email,
    phone: v.phone,
    total_due: +v.total_due.toFixed(2),
    total_paid: +v.total_paid.toFixed(2),
    balance: +(v.total_due - v.total_paid).toFixed(2),
  })).sort((a, b) => b.balance - a.balance)

  return NextResponse.json({
    summary: {
      revenue: +totalRevenue.toFixed(2),
      cost: +totalCost.toFixed(2),
      profit: +(totalRevenue - totalCost).toFixed(2),
    },
    tutors,
    byType,
    bySubject,
    students,
  })
}
