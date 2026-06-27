import { supabaseAdmin } from './supabase'

function toMin(t: string | null | undefined): number {
  if (!t) return 0
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}

export interface ConflictParams {
  date: string
  start_time: string
  end_time: string
  room?: string | null
  tutor_id?: string | null
  /** wszyscy uczniowie tej lekcji (indywidualny: [student_id]; grupa: id wszystkich członków) */
  studentIds?: string[]
  /** pomiń tę lekcję (przy edycji) */
  excludeId?: string
}

/**
 * Zwraca listę czytelnych opisów kolizji: sala, korepetytor, uczeń (też jako członek grupy).
 * Pusta lista = brak kolizji.
 */
export async function findLessonConflicts(p: ConflictParams): Promise<string[]> {
  const newStart = toMin(p.start_time)
  const newEnd = toMin(p.end_time)
  const studentIds = (p.studentIds ?? []).filter(Boolean)

  // nazwy bookowanych uczniów (do komunikatów)
  const nameMap: Record<string, string> = {}
  if (studentIds.length > 0) {
    const { data: studs } = await supabaseAdmin.from('students').select('id, name').in('id', studentIds)
    for (const s of studs ?? []) nameMap[s.id as string] = (s.name as string) || 'uczeń'
  }

  const { data: lessons } = await supabaseAdmin
    .from('lessons')
    .select('id, start_time, end_time, room, tutor_id, student_id, tutors(name), lesson_students(student_id)')
    .eq('date', p.date)

  const conflicts: string[] = []

  for (const l of lessons ?? []) {
    if (p.excludeId && l.id === p.excludeId) continue
    const overlap = toMin(l.start_time) < newEnd && toMin(l.end_time) > newStart
    if (!overlap) continue

    const time = `${String(l.start_time).substring(0, 5)}–${String(l.end_time).substring(0, 5)}`
    const tutorName = (l.tutors as unknown as { name: string } | null)?.name || 'korepetytor'

    // 1. Kolizja sali
    if (p.room && l.room === p.room) {
      conflicts.push(`Sala zajęta: ${l.room} o ${time} (${tutorName})`)
    }

    // 2. Kolizja korepetytora (ta sama osoba, dowolna sala)
    if (p.tutor_id && l.tutor_id === p.tutor_id) {
      conflicts.push(`Korepetytor ${tutorName} ma już zajęcia o ${time} (${l.room ?? '—'})`)
    }

    // 3. Kolizja ucznia — czy któryś z bookowanych uczniów jest już zajęty tą lekcją
    if (studentIds.length > 0) {
      const occupants = new Set<string>()
      if (l.student_id) occupants.add(l.student_id as string)
      for (const ls of (l.lesson_students as unknown as { student_id: string }[] | null) ?? []) {
        if (ls.student_id) occupants.add(ls.student_id)
      }
      for (const sid of studentIds) {
        if (occupants.has(sid)) {
          conflicts.push(`Uczeń ${nameMap[sid] ?? ''} ma już zajęcia o ${time}`)
        }
      }
    }
  }

  return [...new Set(conflicts)]
}
