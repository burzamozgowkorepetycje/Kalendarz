-- Synchronizacja zajęć korepetytora z Google Calendar (jednokierunkowa: system -> Google).
--
-- Ta migracja jest SZKIELETEM funkcji — kod jest w pełni napisany i gotowy do działania,
-- ale wymaga prawdziwych danych OAuth z Google Cloud Console (GOOGLE_CLIENT_ID /
-- GOOGLE_CLIENT_SECRET w .env — patrz .env.example). Do tego czasu tabele istnieją,
-- ale żaden korepetytor nie będzie mógł się faktycznie połączyć.
--
-- Projekt: jednokierunkowa synchronizacja — system tworzy/aktualizuje/usuwa wydarzenia
-- w kalendarzu korepetytora. Prywatny kalendarz korepetytora NIE jest nigdy odczytywany.

-- Tokeny OAuth per korepetytor (jeden wpis = jedno połączone konto Google).
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expiry timestamptz NOT NULL,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_tutor ON google_calendar_tokens(tutor_id);

-- Mapowanie zajęcia -> wydarzenie w Google Calendar, żeby przy edycji/usunięciu zajęć
-- dało się znaleźć i zaktualizować/usunąć właściwe wydarzenie (bez osieroconych wpisów).
CREATE TABLE IF NOT EXISTS lesson_google_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_google_events_lesson ON lesson_google_events(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_google_events_tutor ON lesson_google_events(tutor_id);
