import { supabaseAdmin } from './supabase'

function toMin(t: string | null | undefined): number {
  if (!t) return 0
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}

// Indeks dnia tygodnia: 0 = poniedziałek ... 6 = niedziela
export function weekdayIndex(dateStr: string): number {
  const js = new Date(dateStr + 'T00:00:00').getDay() // 0 = niedziela
  return (js + 6) % 7
}

export const WEEKDAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

/**
 * Zwraca miękkie ostrzeżenia, jeśli termin wykracza poza zwykłą dostępność korepetytora.
 * Pusta lista = brak zastrzeżeń (lub dostępność nieustawiona).
 */
export async function availabilityWarnings(p: {
  tutor_id?: string | null
  date: string
  start_time: string
  end_time: string
  subject?: string | null
}): Promise<string[]> {
  if (!p.tutor_id) return []

  const warnings: string[] = []

  // Przedmiot: czy korepetytor uczy tego przedmiotu
  if (p.subject) {
    const { data: t } = await supabaseAdmin.from('tutors').select('subjects').eq('id', p.tutor_id).single()
    const subs = t?.subjects as string[] | null
    if (Array.isArray(subs) && subs.length > 0 && !subs.includes(p.subject)) {
      warnings.push(`Ten korepetytor zwykle nie uczy: ${p.subject} (uczy: ${subs.join(', ')})`)
    }
  }

  const { data: all } = await supabaseAdmin
    .from('tutor_availability')
    .select('weekday, start_time, end_time')
    .eq('tutor_id', p.tutor_id)

  // dostępność nieskonfigurowana → tylko ewentualne ostrzeżenie o przedmiocie
  if (!all || all.length === 0) return warnings

  const weekday = weekdayIndex(p.date)
  const dayRows = all.filter(r => r.weekday === weekday)

  if (dayRows.length === 0) {
    warnings.push(`Korepetytor zwykle nie pracuje w ${WEEKDAY_NAMES[weekday].toLowerCase()}`)
    return warnings
  }

  const s = toMin(p.start_time)
  const e = toMin(p.end_time)
  const inside = dayRows.some(r => toMin(r.start_time) <= s && toMin(r.end_time) >= e)
  if (!inside) {
    const ranges = dayRows
      .map(r => `${String(r.start_time).substring(0, 5)}–${String(r.end_time).substring(0, 5)}`)
      .join(', ')
    warnings.push(`Korepetytor zwykle pracuje w ${WEEKDAY_NAMES[weekday].toLowerCase()}: ${ranges}`)
  }

  return warnings
}
