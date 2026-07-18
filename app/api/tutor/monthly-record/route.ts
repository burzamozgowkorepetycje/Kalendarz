import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'
import { getTutorMonthlyRecord } from '@/lib/tutorMonthlyRecord'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// GET: korepetytor pobiera wlasna miesieczna ewidencje pracy i wynagrodzenia
export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') || currentMonth()
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Nieprawidlowy format miesiaca' }, { status: 400 })

  const result = await getTutorMonthlyRecord(tutor.tutorId, month)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json(result)
}

// POST: korepetytor zatwierdza swoj miesiac ("zatwierdzone przez korepetytora")
export async function POST(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { month } = await req.json()
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Nieprawidlowy format miesiaca' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('tutor_monthly_approvals')
    .upsert(
      { tutor_id: tutor.tutorId, month, approved: true, approved_at: new Date().toISOString() },
      { onConflict: 'tutor_id,month' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
