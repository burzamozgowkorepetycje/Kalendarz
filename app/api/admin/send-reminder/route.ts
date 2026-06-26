import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPaymentReminderEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, amount } = await req.json()

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', student_id)
    .single()

  if (error || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  if (student.email) {
    await sendPaymentReminderEmail(student.email, student.name, amount)
  }

  if (student.phone) {
    await sendSMS(student.phone, `Przypomnienie o płatności: masz ${amount} zł do uregulowania za korepetycje.`)
  }

  return NextResponse.json({ success: true })
}
