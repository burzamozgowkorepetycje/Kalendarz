import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

// Mark all unpaid lessons/lesson_students for a student as paid
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, lesson_id } = await req.json()

  if (lesson_id) {
    // Pay single lesson
    await supabaseAdmin.from('lessons').update({ payment_status: 'paid' }).eq('id', lesson_id)
    await supabaseAdmin.from('lesson_students').update({ payment_status: 'paid' }).eq('lesson_id', lesson_id).eq('student_id', student_id)
  } else if (student_id) {
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
  }

  return NextResponse.json({ success: true })
}
