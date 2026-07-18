import { supabaseAdmin } from './supabase'
import { createEvent, updateEvent, deleteEvent, isTutorConnected, CalendarEventInput } from './googleCalendar'

// Synchronizacja zajęć -> Google Calendar korepetytora (jednokierunkowo: my -> Google).
//
// TWARDA ZASADA: żadna funkcja tutaj nigdy nie rzuca wyjątkiem na zewnątrz. Błąd sieci,
// wygasły/odwołany token, brak konfiguracji Google — wszystko jest łapane i logowane.
// Zapis/edycja/usunięcie zajęć w bazie NIE MOŻE zależeć od tego, czy Google Calendar
// odpowiedział poprawnie.

export interface SyncableLesson {
  id: string
  date: string
  start_time: string
  end_time: string
  tutor_id: string | null
  student_id: string | null
  room: string | null
  location?: string | null
  subject?: string | null
  is_group?: boolean | null
}

function toIso(date: string, time: string): string {
  // date: 'YYYY-MM-DD', time: 'HH:mm' -> 'YYYY-MM-DDTHH:mm:00' (bez offsetu, timeZone podany osobno)
  return `${date}T${time.length === 5 ? time + ':00' : time}`
}

async function firstName(studentId: string | null): Promise<string | null> {
  if (!studentId) return null
  const { data } = await supabaseAdmin.from('students').select('name').eq('id', studentId).single()
  if (!data?.name) return null
  return String(data.name).split(' ')[0]
}

/** Buduje minimalną treść wydarzenia — bez kwot i bez pełnych danych kontaktowych ucznia
 * (data-minimization: tylko imię ucznia + przedmiot + sala/tryb, zgodnie z decyzją produktową). */
async function buildEventInput(lesson: SyncableLesson): Promise<CalendarEventInput> {
  let who = 'Zajęcia'
  if (lesson.is_group) {
    who = 'Zajęcia grupowe'
  } else {
    const name = await firstName(lesson.student_id)
    if (name) who = name
  }
  const subject = lesson.subject ? ` — ${lesson.subject}` : ''
  const place = lesson.location === 'Online' ? 'Online' : (lesson.room || lesson.location || null)

  return {
    summary: `${who}${subject}`,
    location: place,
    startDateTime: toIso(lesson.date, lesson.start_time),
    endDateTime: toIso(lesson.date, lesson.end_time),
  }
}

async function getMapping(lessonId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('lesson_google_events')
    .select('google_event_id')
    .eq('lesson_id', lessonId)
    .single()
  return (data?.google_event_id as string) || null
}

/** Woła się po pomyślnym utworzeniu zajęć. Nigdy nie rzuca. */
export async function syncLessonCreate(lesson: SyncableLesson): Promise<void> {
  try {
    if (!lesson.tutor_id) return
    if (!(await isTutorConnected(lesson.tutor_id))) return

    const input = await buildEventInput(lesson)
    const googleEventId = await createEvent(lesson.tutor_id, input)
    if (!googleEventId) return

    await supabaseAdmin.from('lesson_google_events').upsert(
      {
        lesson_id: lesson.id,
        tutor_id: lesson.tutor_id,
        google_event_id: googleEventId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lesson_id' }
    )
  } catch (err) {
    console.error('[googleCalendarSync] createEvent failed (non-blocking):', err)
  }
}

/** Woła się po pomyślnej edycji zajęć (np. zmiana terminu/sali/ucznia/korepetytora). Nigdy nie rzuca. */
export async function syncLessonUpdate(lesson: SyncableLesson, previousTutorId?: string | null): Promise<void> {
  try {
    if (!lesson.tutor_id) {
      // Zajęcia przestały mieć przypisanego korepetytora — usuń wydarzenie, jeśli istniało.
      await syncLessonDelete(lesson.id, previousTutorId ?? null)
      return
    }

    // Korepetytor się zmienił: usuń stare wydarzenie u poprzedniego korepetytora, stwórz nowe u nowego.
    if (previousTutorId && previousTutorId !== lesson.tutor_id) {
      await syncLessonDelete(lesson.id, previousTutorId)
      await syncLessonCreate(lesson)
      return
    }

    if (!(await isTutorConnected(lesson.tutor_id))) return

    const existingEventId = await getMapping(lesson.id)
    const input = await buildEventInput(lesson)

    if (!existingEventId) {
      // Korepetytor połączył konto już po utworzeniu zajęć — utwórz wydarzenie teraz.
      await syncLessonCreate(lesson)
      return
    }

    await updateEvent(lesson.tutor_id, existingEventId, input)
    await supabaseAdmin
      .from('lesson_google_events')
      .update({ updated_at: new Date().toISOString() })
      .eq('lesson_id', lesson.id)
  } catch (err) {
    console.error('[googleCalendarSync] updateEvent failed (non-blocking):', err)
  }
}

/** Woła się po usunięciu/odwołaniu zajęć (pojedynczych lub całej serii). Nigdy nie rzuca. */
export async function syncLessonDelete(lessonId: string, tutorId: string | null): Promise<void> {
  try {
    if (!tutorId) return
    const existingEventId = await getMapping(lessonId)
    if (!existingEventId) return
    if (await isTutorConnected(tutorId)) {
      await deleteEvent(tutorId, existingEventId)
    }
    await supabaseAdmin.from('lesson_google_events').delete().eq('lesson_id', lessonId)
  } catch (err) {
    console.error('[googleCalendarSync] deleteEvent failed (non-blocking):', err)
  }
}

/** Usuwa wiele zajęć naraz (np. cała seria cykliczna). Nigdy nie rzuca. */
export async function syncLessonsDeleteMany(lessonIds: string[], tutorIdByLesson?: Map<string, string | null>): Promise<void> {
  for (const id of lessonIds) {
    const tutorId = tutorIdByLesson?.get(id) ?? null
    await syncLessonDelete(id, tutorId)
  }
}
