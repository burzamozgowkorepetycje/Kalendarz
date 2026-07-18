import { supabaseAdmin } from './supabase'

// --- Konfiguracja OAuth (SZKIELET) ---------------------------------------
// Te zmienne NIE są jeszcze ustawione — właściciel musi założyć projekt w Google
// Cloud Console i wkleić prawdziwe wartości. Zobacz .env.example po instrukcje.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ''

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

// Uprawnienia: tylko zapis do kalendarza podstawowego korepetytora — nie czytamy
// istniejących (prywatnych) wydarzeń.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)
}

/** Buduje URL do ekranu zgody Google. `state` powinien zawierać podpisany identyfikator korepetytora. */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES.join(' '),
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

/** Wymienia kod autoryzacyjny z callbacku na tokeny i zapisuje je w bazie. */
export async function exchangeCodeForTokens(tutorId: string, code: string): Promise<void> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token exchange failed: ${res.status} ${body}`)
  }

  const data: GoogleTokenResponse = await res.json()
  if (!data.refresh_token) {
    // Google zwraca refresh_token tylko przy pierwszej zgodzie (prompt=consent go wymusza,
    // ale zabezpieczamy się na wypadek ponownego połączenia bez refresh_token).
    const { data: existing } = await supabaseAdmin
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('tutor_id', tutorId)
      .single()
    if (!existing?.refresh_token) {
      throw new Error('Google nie zwrócił refresh_token — spróbuj połączyć ponownie (odwołaj dostęp w koncie Google i połącz jeszcze raz).')
    }
    data.refresh_token = existing.refresh_token
  }

  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabaseAdmin.from('google_calendar_tokens').upsert(
    {
      tutor_id: tutorId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry,
      scope: data.scope || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tutor_id' }
  )
}

async function refreshAccessToken(tutorId: string, refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token refresh failed: ${res.status} ${body}`)
  }

  const data: GoogleTokenResponse = await res.json()
  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabaseAdmin
    .from('google_calendar_tokens')
    .update({ access_token: data.access_token, expiry, updated_at: new Date().toISOString() })
    .eq('tutor_id', tutorId)

  return data.access_token
}

/** Zwraca ważny access_token dla korepetytora, odświeżając go w razie wygaśnięcia. Null jeśli niepołączony. */
async function getValidAccessToken(tutorId: string): Promise<string | null> {
  const { data: row } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expiry')
    .eq('tutor_id', tutorId)
    .single()

  if (!row) return null

  const expiresInMs = new Date(row.expiry as string).getTime() - Date.now()
  if (expiresInMs > 60_000) {
    return row.access_token as string
  }

  return refreshAccessToken(tutorId, row.refresh_token as string)
}

export async function isTutorConnected(tutorId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('tutor_id')
    .eq('tutor_id', tutorId)
    .single()
  return Boolean(data)
}

/** Usuwa zapisane tokeny korepetytora. Istniejące wydarzenia w Google Calendar zostają bez zmian. */
export async function disconnectTutor(tutorId: string): Promise<void> {
  await supabaseAdmin.from('google_calendar_tokens').delete().eq('tutor_id', tutorId)
}

export interface CalendarEventInput {
  /** Minimalne dane — bez informacji finansowych i pełnych danych kontaktowych ucznia. */
  summary: string
  location?: string | null
  description?: string | null
  /** ISO 8601 z offsetem lub 'YYYY-MM-DDTHH:mm:ss' + timeZone. */
  startDateTime: string
  endDateTime: string
  timeZone?: string
}

const DEFAULT_TIMEZONE = 'Europe/Warsaw'

/** Tworzy wydarzenie w podstawowym kalendarzu korepetytora. Zwraca google_event_id lub null jeśli niepołączony. */
export async function createEvent(tutorId: string, event: CalendarEventInput): Promise<string | null> {
  const token = await getValidAccessToken(tutorId)
  if (!token) return null

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.summary,
      location: event.location || undefined,
      description: event.description || undefined,
      start: { dateTime: event.startDateTime, timeZone: event.timeZone || DEFAULT_TIMEZONE },
      end: { dateTime: event.endDateTime, timeZone: event.timeZone || DEFAULT_TIMEZONE },
      // Brak custom reminders celowo — korzystamy z domyślnych ustawień przypomnień
      // korepetytora w Google Calendar (patrz decyzje w opisie funkcji).
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google createEvent failed: ${res.status} ${body}`)
  }

  const data = await res.json()
  return data.id as string
}

export async function updateEvent(tutorId: string, googleEventId: string, event: CalendarEventInput): Promise<void> {
  const token = await getValidAccessToken(tutorId)
  if (!token) return

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: event.summary,
      location: event.location || undefined,
      description: event.description || undefined,
      start: { dateTime: event.startDateTime, timeZone: event.timeZone || DEFAULT_TIMEZONE },
      end: { dateTime: event.endDateTime, timeZone: event.timeZone || DEFAULT_TIMEZONE },
    }),
  })

  if (!res.ok) {
    // 404/410 = wydarzenie zostało ręcznie usunięte w Google Calendar — traktujemy jako
    // "nic do zrobienia", nie jako błąd synchronizacji.
    if (res.status === 404 || res.status === 410) return
    const body = await res.text()
    throw new Error(`Google updateEvent failed: ${res.status} ${body}`)
  }
}

export async function deleteEvent(tutorId: string, googleEventId: string): Promise<void> {
  const token = await getValidAccessToken(tutorId)
  if (!token) return

  const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok && res.status !== 404 && res.status !== 410 && res.status !== 204) {
    const body = await res.text()
    throw new Error(`Google deleteEvent failed: ${res.status} ${body}`)
  }
}
