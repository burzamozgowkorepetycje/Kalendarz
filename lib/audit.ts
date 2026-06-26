import { supabaseAdmin } from './supabase'

export interface AuditEntry {
  actor_type: 'admin' | 'tutor'
  actor_name: string
  action: 'create' | 'update' | 'delete'
  summary: string
}

/** Zapisuje wpis w historii zmian. Błędy nie blokują operacji głównej. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabaseAdmin.from('audit_log').insert(entry)
  } catch {
    // historia jest pomocnicza — nie przerywamy działania jeśli się nie zapisze
  }
}

/** Buduje czytelny opis lekcji do historii (data, godzina, sala, uczeń). */
export async function describeLesson(lesson: {
  date?: string | null
  start_time?: string | null
  room?: string | null
  student_id?: string | null
  is_group?: boolean | null
}): Promise<string> {
  let who = ''
  if (lesson.student_id) {
    const { data } = await supabaseAdmin.from('students').select('name').eq('id', lesson.student_id).single()
    who = data?.name || ''
  } else if (lesson.is_group) {
    who = 'grupa'
  }
  const time = lesson.start_time ? String(lesson.start_time).substring(0, 5) : ''
  return [lesson.date, time, lesson.room, who].filter(Boolean).join(' · ')
}
