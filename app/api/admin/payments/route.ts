import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hasFinancialAccess } from '@/lib/auth'


// Mark all unpaid lessons/lesson_students for a student as paid
export async function POST(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, lesson_id } = await req.json()

  if (lesson_id) {
    // Pay single lesson
    await supabaseAdmin.from('lessons').update({ payment_status: 'paid' }).eq('id', lesson_id)
    await supabaseAdmin.from('lesson_students').update({ payment_status: 'paid' }).eq('lesson_id', lesson_id).eq('student_id', student_id)
  } else if (student_id) {
    // Zsumuj zaległość przed oznaczeniem jako zapłacone (do zużycia kredytu)
    const { data: unpaidLessons } = await supabaseAdmin
      .from('lessons')
      .select('amount_due')
      .eq('student_id', student_id)
      .eq('payment_status', 'unpaid')
    const { data: unpaidGroup } = await supabaseAdmin
      .from('lesson_students')
      .select('amount_due')
      .eq('student_id', student_id)
      .eq('payment_status', 'unpaid')

    const due =
      (unpaidLessons ?? []).reduce((s, l) => s + (Number(l.amount_due) || 0), 0) +
      (unpaidGroup ?? []).reduce((s, l) => s + (Number(l.amount_due) || 0), 0)

    // Pay ALL unpaid for this student
    await supabaseAdmin
      .from('lessons')
      .update({ payment_status: 'paid' })
      .eq('student_id', student_id)
      .eq('payment_status', 'unpaid')

    await supabaseAdmin
      .from('lesson_students')
      .update({ payment_status: 'paid' })
      .eq('student_id', student_id)
      .eq('payment_status', 'unpaid')

    // Zużyj kredyt ucznia (nadpłata pomniejsza tę zapłatę)
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('credit_balance')
      .eq('id', student_id)
      .single()
    const credit = Number(student?.credit_balance) || 0
    if (credit > 0) {
      const consumed = Math.min(credit, due)
      await supabaseAdmin
        .from('students')
        .update({ credit_balance: +(credit - consumed).toFixed(2) })
        .eq('id', student_id)
    }
  }

  return NextResponse.json({ success: true })
}
