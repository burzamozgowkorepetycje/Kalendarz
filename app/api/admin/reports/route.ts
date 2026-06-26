import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const from = searchParams.get('from') || '2000-01-01'
  const to = searchParams.get('to') || '2099-12-31'

  if (type === 'tutor-hours') {
    const { data, error } = await supabaseAdmin
      .from('lessons')
      .select('tutor_id, duration_minutes, amount_due, tutor_amount, status, tutors(name)')
      .eq('status', 'completed')
      .gte('date', from)
      .lte('date', to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const grouped: Record<string, { name: string; minutes: number; revenue: number; cost: number }> = {}
    for (const lesson of data ?? []) {
      const tid = lesson.tutor_id as string
      const tutor = lesson.tutors as unknown as { name: string } | null
      if (!grouped[tid]) {
        grouped[tid] = { name: tutor?.name ?? 'Nieznany', minutes: 0, revenue: 0, cost: 0 }
      }
      grouped[tid].minutes += lesson.duration_minutes
      grouped[tid].revenue += lesson.amount_due ?? 0
      grouped[tid].cost += lesson.tutor_amount ?? 0
    }

    return NextResponse.json(
      Object.entries(grouped).map(([id, v]) => ({
        tutor_id: id,
        name: v.name,
        hours: +(v.minutes / 60).toFixed(1),
        revenue: +v.revenue.toFixed(2),
        cost: +v.cost.toFixed(2),
        profit: +(v.revenue - v.cost).toFixed(2),
      }))
    )
  }

  if (type === 'payments') {
    // Individual lessons
    const { data: indivData } = await supabaseAdmin
      .from('lessons')
      .select('student_id, amount_due, payment_status, students(name, email, phone)')
      .eq('is_group', false)
      .in('status', ['booked', 'completed'])
      .gte('date', from)
      .lte('date', to)
      .not('student_id', 'is', null)

    // Group lesson students
    const { data: groupData } = await supabaseAdmin
      .from('lesson_students')
      .select('student_id, amount_due, payment_status, students(name, email, phone), lessons!inner(date, status)')
      .in('lessons.status', ['booked', 'completed'])
      .gte('lessons.date', from)
      .lte('lessons.date', to)

    const grouped: Record<string, { name: string; email: string | null; phone: string | null; total_due: number; total_paid: number }> = {}

    const addEntry = (sid: string, s: { name: string; email?: string | null; phone?: string | null } | null, amt: number, paid: boolean) => {
      if (!sid) return
      if (!grouped[sid]) grouped[sid] = { name: s?.name ?? 'Nieznany', email: s?.email ?? null, phone: s?.phone ?? null, total_due: 0, total_paid: 0 }
      grouped[sid].total_due += amt
      if (paid) grouped[sid].total_paid += amt
    }

    for (const l of indivData ?? []) {
      addEntry(l.student_id as string, l.students as unknown as { name: string; email?: string | null; phone?: string | null } | null, l.amount_due ?? 0, l.payment_status === 'paid')
    }
    for (const ls of groupData ?? []) {
      addEntry(ls.student_id as string, ls.students as unknown as { name: string; email?: string | null; phone?: string | null } | null, ls.amount_due ?? 0, ls.payment_status === 'paid')
    }

    return NextResponse.json(
      Object.entries(grouped).map(([id, v]) => ({
        student_id: id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        total_due: +v.total_due.toFixed(2),
        total_paid: +v.total_paid.toFixed(2),
        balance: +(v.total_due - v.total_paid).toFixed(2),
      }))
    )
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}
