import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTutorMonthlyRecord } from '@/lib/tutorMonthlyRecord'
import { hasFinancialAccess } from '@/lib/auth'


function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// GET: admin pobiera miesieczna ewidencje dowolnego korepetytora
export async function GET(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tutorId = searchParams.get('tutor_id')
  const month = searchParams.get('month') || currentMonth()

  if (!tutorId) return NextResponse.json({ error: 'Brak tutor_id' }, { status: 400 })
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Nieprawidlowy format miesiaca' }, { status: 400 })

  const result = await getTutorMonthlyRecord(tutorId, month)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json(result)
}

// POST: admin dodaje/aktualizuje korekte dnia (kwota + notatka uzasadniajaca)
export async function POST(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tutor_id, date, note, amount_adjustment } = await req.json()
  if (!tutor_id || !date || !note) {
    return NextResponse.json({ error: 'Brak tutor_id, date lub note' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tutor_day_adjustments')
    .upsert(
      {
        tutor_id,
        date,
        note,
        amount_adjustment: Number(amount_adjustment) || 0,
        created_by: 'admin',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tutor_id,date' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: admin usuwa korekte dnia (np. korekta byla bledna)
export async function DELETE(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tutorId = searchParams.get('tutor_id')
  const date = searchParams.get('date')
  if (!tutorId || !date) return NextResponse.json({ error: 'Brak tutor_id lub date' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('tutor_day_adjustments')
    .delete()
    .eq('tutor_id', tutorId)
    .eq('date', date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
