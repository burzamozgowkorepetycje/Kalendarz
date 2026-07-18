import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPaymentReminderEmail } from '@/lib/email'
import { sendSMS } from '@/lib/sms'
import { isStaff } from '@/lib/auth'


export async function POST(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  let sms: { ok: boolean; error?: string } | null = null
  if (student.phone) {
    sms = await sendSMS(student.phone, `Przypomnienie o platnosci: masz ${amount} zl do uregulowania za korepetycje.`)
  }

  // Jeśli uczeń nie ma żadnego kanału kontaktu
  if (!student.email && !student.phone) {
    return NextResponse.json({ error: 'Uczeń nie ma email ani telefonu' }, { status: 400 })
  }

  // Jeśli SMS się nie powiódł — zgłoś to do UI
  if (sms && !sms.ok) {
    return NextResponse.json({ error: `SMS nie wysłany: ${sms.error}` }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
