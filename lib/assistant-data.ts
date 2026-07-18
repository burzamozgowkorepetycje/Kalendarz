import { supabaseAdmin } from './supabase'

/**
 * Warstwa dostepu do danych dla asystenta AI sekretariatu.
 *
 * Zasada bezpieczenstwa: asystent NIGDY nie uzywa `select('*')` ani nie dostaje
 * surowego/szerokiego narzedzia do zapytan SQL. Kazda tabela ma sztywna,
 * zakodowana na stale liste dozwolonych kolumn (ponizej), ktora PO PROSTU NIE
 * ZAWIERA pol finansowych (stawki, kwoty, wynagrodzenia, marza). Dzieki temu
 * nawet join czy literowka nie moze "przypadkiem" ujawnic finansow — kolumny
 * finansowe nigdy nie trafiaja do zapytania, niezaleznie od roli pytajacego.
 * (Dla porownania: reszta apki uzywa stripFinancialFieldsDeep z lib/auth.ts,
 * ktore filtruje PO fakcie — tu wolimy nie pobierac tych danych w ogole.)
 *
 * Rola nie zmienia listy kolumn (asystent nie pokazuje finansow nikomu, nawet
 * adminowi — zgodnie ze specyfikacja "Never reveal hourly rates or tutor
 * earnings"), ale nadal wymagamy zalogowanego pracownika (patrz API route).
 */

export const ASSISTANT_SAFE_COLUMNS = {
  students: ['id', 'name', 'email', 'phone', 'notes', 'birth_date', 'grade', 'location', 'status', 'created_at'],
  tutors: ['id', 'name', 'email', 'phone', 'meet_link', 'subjects', 'works_online', 'works_onsite', 'active'],
  course_groups: ['id', 'name', 'subject', 'level', 'is_maturzysta', 'is_e8', 'location', 'duration_minutes', 'active', 'tutor_id'],
  student_enrollments: ['id', 'student_id', 'subject', 'mode', 'location', 'is_maturzysta', 'is_e8', 'active', 'cancelled_at', 'created_at'],
  lessons: ['id', 'date', 'start_time', 'end_time', 'duration_minutes', 'tutor_id', 'student_id', 'status', 'location', 'is_group', 'subject', 'course_group_id'],
} as const

export type AssistantTable = keyof typeof ASSISTANT_SAFE_COLUMNS

/** Slowa kluczowe decydujace, ktore tabele warto przeszukac dla danego pytania. */
const TABLE_KEYWORDS: Record<AssistantTable, string[]> = {
  students: ['uczeń', 'uczen', 'uczni', 'ucznia', 'ucznio'],
  tutors: ['korepetytor', 'nauczyciel', 'lektor', 'tutor'],
  course_groups: ['grupa', 'grupy', 'grupie', 'grupę'],
  student_enrollments: ['zapis', 'zapisany', 'zapisani', 'przedmiot', 'zapisów'],
  lessons: ['lekcj', 'zajęci', 'zajec', 'harmonogram', 'grafik', 'termin', 'kiedy', 'godzin'],
}

/**
 * Czysta funkcja: na podstawie tresci pytania wybiera, ktore (bezpieczne)
 * tabele warto przeszukac. Nie dotyka bazy — testowalna w izolacji.
 */
export function pickRelevantTables(question: string): AssistantTable[] {
  const q = question.toLowerCase()
  const hits = (Object.keys(TABLE_KEYWORDS) as AssistantTable[]).filter((table) =>
    TABLE_KEYWORDS[table].some((kw) => q.includes(kw))
  )
  // Brak trafien -> domyslnie przeszukaj uczniow i korepetytorow (najczestsze pytania sekretariatu)
  return hits.length > 0 ? hits : ['students', 'tutors']
}

/**
 * Czysta funkcja: wyciaga z pytania kandydatow na imiona/nazwiska (ciagi
 * zaczynajace sie wielka litera, 2+ znaki), zeby moc doszukac konkretnego
 * ucznia/korepetytora w bazie bez zaciagania calej tabeli do kontekstu.
 */
export function extractNameCandidates(question: string): string[] {
  const matches = question.match(/\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)?/gu) || []
  const STOPWORDS = new Set(['Czy', 'Kiedy', 'Gdzie', 'Jak', 'Ile', 'Kto', 'Co', 'Proszę', 'Prosze'])
  return Array.from(new Set(matches.filter((m) => !STOPWORDS.has(m.split(' ')[0]))))
}

/** Buduje select() ograniczony do bezpiecznych kolumn danej tabeli. */
export function safeSelect(table: AssistantTable): string {
  return ASSISTANT_SAFE_COLUMNS[table].join(', ')
}

export interface AssistantContext {
  students: Record<string, unknown>[]
  tutors: Record<string, unknown>[]
  course_groups: Record<string, unknown>[]
  student_enrollments: Record<string, unknown>[]
  lessons: Record<string, unknown>[]
}

/**
 * Pobiera lekki, ograniczony do zakresu pytania kontekst danych operacyjnych
 * (bez finansow — patrz ASSISTANT_SAFE_COLUMNS). Nie pobiera calych tabel:
 * jesli w pytaniu pada imie/nazwisko, szuka konkretnego rekordu; w przeciwnym
 * razie zwraca krotka probke (limit), zeby nie zapychac kontekstu modelu.
 */
export async function fetchAssistantContext(question: string): Promise<AssistantContext> {
  const tables = pickRelevantTables(question)
  const names = extractNameCandidates(question)

  const empty: AssistantContext = { students: [], tutors: [], course_groups: [], student_enrollments: [], lessons: [] }
  const result: AssistantContext = { ...empty }

  for (const table of tables) {
    const cols = safeSelect(table)
    let query = supabaseAdmin.from(table).select(cols)

    if (names.length > 0 && (table === 'students' || table === 'tutors')) {
      const or = names.map((n) => `name.ilike.%${n}%`).join(',')
      query = query.or(or)
    }

    const { data } = await query.limit(15)
    result[table] = ((data as unknown) as Record<string, unknown>[]) || []
  }

  // Jesli trafiono konkretnego ucznia, dociagnij jego zapisy (potrzebne np. do
  // pytan "na co jest zapisany X").
  if (result.students.length > 0 && !tables.includes('student_enrollments')) {
    const ids = result.students.map((s) => s.id as string)
    const { data } = await supabaseAdmin
      .from('student_enrollments')
      .select(safeSelect('student_enrollments'))
      .in('student_id', ids)
      .limit(30)
    result.student_enrollments = ((data as unknown) as Record<string, unknown>[]) || []
  }

  return result
}
