import { supabaseAdmin } from '@/lib/supabase'

// Miesieczna ewidencja pracy i wynagrodzenia korepetytora — logika wspolna
// dla widoku korepetytora (self-service) i widoku admina.
//
// Reuzywa te sama konwencje filtrowania co app/api/tutor/earnings/route.ts
// i app/api/admin/tutor-billing/route.ts:
//  - liczymy wylacznie lekcje z count_toward_earnings = true
//  - pomijamy status = 'cancelled' (odwolane zajecia nie licza sie do wynagrodzenia)
//  - "extra-paid" / dodatkowo platne zajecia sa juz uwzgledniane w tutor_amount per lekcja,
//    wiec nie wymagaja osobnej logiki — sumujemy po prostu tutor_amount

export interface DayRecord {
  date: string
  minutes: number
  hours: number
  lessonsCount: number
  baseAmount: number
  adjustment: number
  adjustmentNote: string | null
  amount: number // baseAmount + adjustment
  runningTotal: number
}

export interface MonthlyRecordSummary {
  totalMinutes: number
  totalHours: number
  totalLessons: number
  totalBaseAmount: number
  totalAdjustments: number
  totalAmount: number
}

export interface MonthlyApproval {
  approved: boolean
  approved_at: string | null
}

export interface MonthlyRecord {
  tutor_id: string
  tutor_name: string
  month: string
  days: DayRecord[]
  summary: MonthlyRecordSummary
  approval: MonthlyApproval
}

function monthBounds(month: string): { from: string; to: string } {
  // month: 'YYYY-MM'
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate() // dzien 0 nastepnego miesiaca = ostatni dzien biezacego
  const to = `${month}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export async function getTutorMonthlyRecord(tutorId: string, month: string): Promise<MonthlyRecord | { error: string }> {
  const { from, to } = monthBounds(month)

  const { data: tutor, error: tutorErr } = await supabaseAdmin
    .from('tutors')
    .select('id, name')
    .eq('id', tutorId)
    .single()

  if (tutorErr || !tutor) return { error: 'Nie znaleziono korepetytora' }

  const { data: lessons, error: lessonsErr } = await supabaseAdmin
    .from('lessons')
    .select('id, date, duration_minutes, tutor_amount, status, count_toward_earnings')
    .eq('tutor_id', tutorId)
    .eq('count_toward_earnings', true)
    .neq('status', 'cancelled')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (lessonsErr) return { error: lessonsErr.message }

  const { data: adjustments, error: adjErr } = await supabaseAdmin
    .from('tutor_day_adjustments')
    .select('date, note, amount_adjustment')
    .eq('tutor_id', tutorId)
    .gte('date', from)
    .lte('date', to)

  if (adjErr) return { error: adjErr.message }

  const { data: approvalRow } = await supabaseAdmin
    .from('tutor_monthly_approvals')
    .select('approved, approved_at')
    .eq('tutor_id', tutorId)
    .eq('month', month)
    .maybeSingle()

  const adjMap = new Map<string, { note: string; amount: number }>()
  for (const a of adjustments ?? []) {
    adjMap.set(a.date as string, { note: a.note as string, amount: Number(a.amount_adjustment) || 0 })
  }

  const dayMap = new Map<string, { minutes: number; lessonsCount: number; amount: number }>()
  for (const l of lessons ?? []) {
    const d = l.date as string
    const entry = dayMap.get(d) || { minutes: 0, lessonsCount: 0, amount: 0 }
    entry.minutes += l.duration_minutes || 0
    entry.lessonsCount += 1
    entry.amount += Number(l.tutor_amount) || 0
    dayMap.set(d, entry)
  }

  // wlacz do zestawienia rowniez dni z sama korekta admina (bez zadnej lekcji tego dnia)
  for (const date of adjMap.keys()) {
    if (!dayMap.has(date)) dayMap.set(date, { minutes: 0, lessonsCount: 0, amount: 0 })
  }

  const dates = Array.from(dayMap.keys()).sort()
  let running = 0
  const days: DayRecord[] = dates.map(date => {
    const d = dayMap.get(date)!
    const adj = adjMap.get(date)
    const adjustment = adj?.amount ?? 0
    const amount = d.amount + adjustment
    running += amount
    return {
      date,
      minutes: d.minutes,
      hours: +(d.minutes / 60).toFixed(2),
      lessonsCount: d.lessonsCount,
      baseAmount: +d.amount.toFixed(2),
      adjustment: +adjustment.toFixed(2),
      adjustmentNote: adj?.note ?? null,
      amount: +amount.toFixed(2),
      runningTotal: +running.toFixed(2),
    }
  })

  const summary: MonthlyRecordSummary = {
    totalMinutes: days.reduce((s, d) => s + d.minutes, 0),
    totalHours: +(days.reduce((s, d) => s + d.minutes, 0) / 60).toFixed(2),
    totalLessons: days.reduce((s, d) => s + d.lessonsCount, 0),
    totalBaseAmount: +days.reduce((s, d) => s + d.baseAmount, 0).toFixed(2),
    totalAdjustments: +days.reduce((s, d) => s + d.adjustment, 0).toFixed(2),
    totalAmount: +days.reduce((s, d) => s + d.amount, 0).toFixed(2),
  }

  return {
    tutor_id: tutor.id,
    tutor_name: tutor.name,
    month,
    days,
    summary,
    approval: {
      approved: approvalRow?.approved ?? false,
      approved_at: approvalRow?.approved_at ?? null,
    },
  }
}
