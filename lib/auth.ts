import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

/**
 * Role pracownikow panelu admina.
 * - admin: pelny dostep (finanse, konfiguracja, raporty, wszystko).
 * - secretariat: uczniowie, kontakty, harmonogram, zapisy, grupy, korepetytorzy —
 *   BEZ dostepu do stawek, wynagrodzen korepetytorow, marzy, zysku i pelnych raportow finansowych.
 */
export type StaffRole = 'admin' | 'secretariat'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

function extractToken(req: NextRequest): string {
  const auth = req.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}

/**
 * Ustala role zalogowanego pracownika na podstawie hasla przeslanego jako Bearer token.
 *
 * - Zgodnosc wsteczna: haslo rowne ADMIN_PASSWORD => rola 'admin' (dotychczasowe zachowanie,
 *   dziala bez zadnej dodatkowej konfiguracji).
 * - Konta sekretariatu: aktywny wiersz w tabeli `staff_accounts` z dopasowanym haslem (bcrypt)
 *   => rola zapisana w tym wierszu. Wlasciciel zaklada takie konto przez
 *   POST /api/admin/staff (wymaga roli 'admin').
 */
export async function getStaffRole(req: NextRequest): Promise<StaffRole | null> {
  const token = extractToken(req)
  if (!token) return null
  if (token === ADMIN_PASSWORD) return 'admin'

  const { data: accounts } = await supabaseAdmin
    .from('staff_accounts')
    .select('password_hash, role')
    .eq('active', true)

  if (!accounts) return null
  for (const acc of accounts) {
    if (await bcrypt.compare(token, acc.password_hash as string)) {
      return acc.role as StaffRole
    }
  }
  return null
}

/** Dowolny zalogowany pracownik (admin lub sekretariat). */
export async function isStaff(req: NextRequest): Promise<boolean> {
  return (await getStaffRole(req)) !== null
}

/** Tylko administrator (finanse, konfiguracja, pelne raporty). */
export async function hasFinancialAccess(req: NextRequest): Promise<boolean> {
  return (await getStaffRole(req)) === 'admin'
}

export async function requireRole(req: NextRequest, role: StaffRole): Promise<boolean> {
  return (await getStaffRole(req)) === role
}

/** Pola uznawane za dane finansowe — niedostepne dla roli 'secretariat'. */
export const FINANCIAL_FIELDS = [
  'amount_due',
  'tutor_amount',
  'hourly_rate',
  'rate_individual',
  'rate_pair',
  'rate_group',
  'tutor_rate_per_hour',
  'student_price',
  'price',
  'old_value',
  'new_value',
  'credit_balance',
] as const

/** Usuwa pola finansowe z pojedynczego obiektu (plytko) — do filtrowania danych wejsciowych (body). */
export function stripFinancialFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clone: Record<string, unknown> = { ...obj }
  for (const f of FINANCIAL_FIELDS) delete clone[f]
  return clone as Partial<T>
}

/** Usuwa pola finansowe rekurencyjnie z odpowiedzi (obiekt, tablica lub zagniezdzone relacje). */
export function stripFinancialFieldsDeep<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => stripFinancialFieldsDeep(item)) as unknown as T
  if (data && typeof data === 'object') {
    const clone: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if ((FINANCIAL_FIELDS as readonly string[]).includes(k)) continue
      clone[k] = stripFinancialFieldsDeep(v)
    }
    return clone as T
  }
  return data
}
