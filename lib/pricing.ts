// Domyślna cena ucznia za zajęcia grupowe, w zależności od długości.
export function defaultStudentPrice(durationMinutes: number): number {
  if (durationMinutes === 90) return 80
  if (durationMinutes === 120) return 100
  return Math.round((55 * durationMinutes) / 60)
}

// Domyślna stawka korepetytora za godzinę prowadzenia grupy — zależna od przedmiotu.
export function defaultTutorRatePerHour(subject: string): number {
  if (subject === 'Polski') return 110
  if (subject === 'Matematyka') return 0
  return 0
}
