import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isStaff } from '@/lib/auth'

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6']

function toMin(t: string) { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0) }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }
function weekdayOf(dateStr: string) { return (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7 }

interface LessonRow {
  date: string; start_time: string; end_time: string; room: string | null
  tutor_id: string | null; student_id: string | null
  lesson_students?: { student_id: string }[] | null
}

export async function POST(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const duration: number = Number(body.duration) || 60
  const tutorId: string = body.tutor_id || 'any'
  const studentId: string | null = body.student_id || null
  const weekdays: number[] = Array.isArray(body.weekdays) ? body.weekdays : []
  const fromMin = toMin(body.from_hour || '08:00')
  const toMax = toMin(body.to_hour || '20:00')
  const daysAhead = Math.min(Number(body.days_ahead) || 21, 60)

  const today = new Date()
  const dateFrom = today.toISOString().split('T')[0]
  const end = new Date(today); end.setDate(end.getDate() + daysAhead)
  const dateTo = end.toISOString().split('T')[0]

  // Wszystkie aktywne lekcje w zakresie (do kontroli kolizji)
  const { data: lessonsData } = await supabaseAdmin
    .from('lessons')
    .select('date, start_time, end_time, room, tutor_id, student_id, lesson_students(student_id), status')
    .gte('date', dateFrom).lte('date', dateTo)
    .neq('status', 'cancelled')
  const lessons = (lessonsData ?? []) as LessonRow[]

  // Korepetytorzy + ich dostępność tygodniowa
  const subject: string | null = body.subject || null
  const mode: 'online' | 'onsite' = body.mode === 'online' ? 'online' : 'onsite'
  const { data: tutorsData } = await supabaseAdmin.from('tutors').select('id, name, active, subjects, works_onsite, works_online, meet_link')
  const tutors = (tutorsData ?? []).filter(t => {
    if (t.active === false) return false
    if (mode === 'online' ? (t.works_online === false || !t.meet_link) : t.works_onsite === false) return false
    if (subject && Array.isArray(t.subjects) && t.subjects.length > 0 && !t.subjects.includes(subject)) return false
    return true
  })
  const { data: availData } = await supabaseAdmin.from('tutor_availability').select('tutor_id, weekday, start_time, end_time')
  const availByTutor: Record<string, { weekday: number; start_time: string; end_time: string }[]> = {}
  for (const a of availData ?? []) (availByTutor[a.tutor_id as string] ||= []).push(a)

  const overlaps = (s: number, e: number, ls: number, le: number) => ls < e && le > s

  const tutorFree = (tid: string, date: string, s: number, e: number) =>
    !lessons.some(l => l.date === date && l.tutor_id === tid && overlaps(s, e, toMin(l.start_time), toMin(l.end_time)))

  const roomFree = (room: string, date: string, s: number, e: number) =>
    !lessons.some(l => l.date === date && l.room === room && overlaps(s, e, toMin(l.start_time), toMin(l.end_time)))

  const studentFree = (date: string, s: number, e: number) => {
    if (!studentId) return true
    return !lessons.some(l => {
      if (l.date !== date) return false
      if (!overlaps(s, e, toMin(l.start_time), toMin(l.end_time))) return false
      if (l.student_id === studentId) return true
      return (l.lesson_students ?? []).some( x => x.student_id === studentId)
    })
  }

  const tutorAvailable = (tid: string, date: string, s: number, e: number) => {
    const rows = availByTutor[tid]
    if (!rows || rows.length === 0) return true // brak grafiku = bez ograniczeń
    const wd = weekdayOf(date)
    const day = rows.filter(r => r.weekday === wd)
    if (day.length === 0) return false
    return day.some(r => toMin(r.start_time) <= s && toMin(r.end_time) >= e)
  }

  const candidateTutors = tutorId === 'any' ? tutors : tutors.filter(t => t.id === tutorId)

  const proposals: { date: string; start_time: string; end_time: string; room: string; tutor_id: string; tutor_name: string }[] = []
  const perDay: Record<string, number> = {}
  const MAX = 15, PER_DAY = 3

  for (let i = 0; i <= daysAhead && proposals.length < MAX; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i)
    const date = d.toISOString().split('T')[0]
    if (weekdays.length > 0 && !weekdays.includes(weekdayOf(date))) continue

    for (let s = fromMin; s + duration <= toMax && proposals.length < MAX; s += 30) {
      if ((perDay[date] || 0) >= PER_DAY) break
      const e = s + duration
      if (!studentFree(date, s, e)) continue
      if (mode === 'online') {
        const t = candidateTutors.find(t => tutorFree(t.id as string, date, s, e) && tutorAvailable(t.id as string, date, s, e))
        if (!t) continue
        proposals.push({ date, start_time: hhmm(s), end_time: hhmm(e), room: 'Online', tutor_id: t.id as string, tutor_name: t.name as string })
        perDay[date] = (perDay[date] || 0) + 1
      } else {
        for (const room of ROOMS) {
          if (!roomFree(room, date, s, e)) continue
          const t = candidateTutors.find(t => tutorFree(t.id as string, date, s, e) && tutorAvailable(t.id as string, date, s, e))
          if (!t) continue
          proposals.push({ date, start_time: hhmm(s), end_time: hhmm(e), room, tutor_id: t.id as string, tutor_name: t.name as string })
          perDay[date] = (perDay[date] || 0) + 1
          break
        }
      }
    }
  }

  return NextResponse.json({ proposals })
}
