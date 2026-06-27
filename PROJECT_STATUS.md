# PROJECT STATUS — Korepetycje Calendar
_Ostatnia aktualizacja: 2026-06-27_

> **Deploy:** aplikacja działa na Vercel — `kalendarz-five.vercel.app`
> **Repo:** github.com/burzamozgowkorepetycje/Kalendarz
> **PWA:** instalowalna na telefonie (ekran startowy = launcher: Administracja / Korepetytor)

---

## 1. STOS TECHNOLOGICZNY

| Warstwa | Technologia |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript) |
| Stylowanie | Tailwind CSS |
| Baza danych | Supabase (PostgreSQL) |
| Email | Resend (w trakcie weryfikacji domeny) |
| SMS | **SMSAPI.pl** (wcześniej Twilio — porzucone) |
| Auth korepetytora | JWT + bcrypt (cookie `tutor_token`) |
| Hosting | Vercel |
| Uruchamianie lokalne | `npm run dev` na porcie 3000 |

---

## 2. STRUKTURA PLIKÓW

```
korepetycje-calendar/
│
├── app/
│   ├── page.tsx                          # Strona główna (landing)
│   ├── layout.tsx                        # Layout aplikacji
│   ├── globals.css                       # Style globalne
│   │
│   ├── admin/
│   │   ├── page.tsx                      # Panel admina (logowanie + zakładki)
│   │   └── tabs/
│   │       ├── CalendarTab.tsx           # Kalendarz z siatką 6 sal
│   │       ├── TutorsTab.tsx             # Zarządzanie korepetytorami
│   │       ├── StudentsTab.tsx           # Zarządzanie uczniami + historia
│   │       ├── PaymentsTab.tsx           # Płatności + rozliczenia
│   │       ├── AttendanceTab.tsx         # Lista obecności per dzień
│   │       └── ReportsTab.tsx            # Raporty godzin i zysku
│   │
│   ├── booking/
│   │   └── page.tsx                      # Strona rezerwacji dla korepetytora (via link)
│   │
│   ├── components/
│   │   └── Calendar.tsx                  # Komponent kalendarza (booking publiczny)
│   │
│   └── api/
│       ├── slots/route.ts                # GET: dostępne sloty (dla korepetytora)
│       ├── book/route.ts                 # POST: rezerwacja slotu
│       │
│       ├── admin/
│       │   ├── tutors/route.ts           # CRUD korepetytorów
│       │   ├── students/route.ts         # CRUD uczniów
│       │   ├── lessons/route.ts          # CRUD zajęć
│       │   ├── lesson-students/route.ts  # CRUD uczniów w zajęciach grupowych
│       │   ├── payments/route.ts         # POST: oznacz jako zapłacone (bulk/single)
│       │   ├── reports/route.ts          # GET: raporty godzin i płatności
│       │   ├── send-reminder/route.ts    # POST: wyślij SMS/email przypomnienie
│       │   └── slots/route.ts            # (stary endpoint — do usunięcia)
│       │
│       └── cron/
│           └── reminders/route.ts        # GET: cron — wysyła przypomnienia dzień przed
│
├── lib/
│   ├── types.ts                          # Typy TypeScript (Tutor, Student, Lesson...)
│   ├── supabase.ts                       # Klient Supabase (publiczny + admin)
│   ├── email.ts                          # Funkcje wysyłania emaili (Resend)
│   └── sms.ts                            # Funkcje wysyłania SMS (Twilio)
│
├── .env.local                            # Zmienne środowiskowe (klucze API)
├── vercel.json                           # Konfiguracja cron job (18:00 codziennie)
├── supabase-schema.sql                   # Schema bazy danych
└── SETUP.md                              # Instrukcja konfiguracji
```

---

## 3. TABELE W SUPABASE

### `tutors`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Imię i nazwisko |
| email | TEXT | Email |
| phone | TEXT | Telefon (do SMS) |
| unique_link | TEXT | Unikalny token do linku rezerwacji |
| hourly_rate | NUMERIC | (nieużywane aktualnie — stawka per lekcja) |
| active | BOOLEAN | Czy aktywny |
| created_at | TIMESTAMPTZ | Data dodania |

### `students`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Imię i nazwisko |
| email | TEXT | Email (opcjonalny) |
| phone | TEXT | Telefon (do SMS) |
| notes | TEXT | Notatki |
| created_at | TIMESTAMPTZ | Data dodania |

### `lessons`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID | Primary key |
| date | DATE | Data zajęć |
| start_time | TIME | Godzina rozpoczęcia |
| end_time | TIME | Godzina zakończenia |
| duration_minutes | INTEGER | Czas trwania (30/60/90/120) |
| tutor_id | UUID | FK → tutors |
| student_id | UUID | FK → students (NULL dla grupowych) |
| status | TEXT | available / booked / completed / cancelled |
| attendance | TEXT | present / absent / NULL |
| payment_status | TEXT | unpaid / paid |
| amount_due | NUMERIC | Kwota do zapłaty przez ucznia |
| tutor_amount | NUMERIC | Kwota dla korepetytora (zysk = amount_due - tutor_amount) |
| reminder_sent | BOOLEAN | Czy wysłano przypomnienie |
| room | TEXT | Sala (Sala 1–6) |
| is_group | BOOLEAN | Czy zajęcia grupowe |
| created_at | TIMESTAMPTZ | Data dodania |

### `lesson_students`
| Kolumna | Typ | Opis |
|---|---|---|
| id | UUID | Primary key |
| lesson_id | UUID | FK → lessons |
| student_id | UUID | FK → students |
| amount_due | NUMERIC | Kwota dla tego ucznia w grupie |
| payment_status | TEXT | unpaid / paid |
| created_at | TIMESTAMPTZ | Data dodania |

---

## 4. PANEL ADMINA — ZAKŁADKI I FUNKCJE

### 🗓 Kalendarz
- Widok dzienny z siatką **6 sal × godziny (8:00–20:00)**
- Nawigacja między dniami (← →) + przycisk "Dziś"
- Kliknięcie na kafelek otwiera modal z formularzem
- **Zajęcia indywidualne** — wybór korepetytora + ucznia + kwot
- **Zajęcia grupowe** — wielu uczniów, każdy z osobną kwotą, fioletowy kolor
- **Kwota dla korepetytora** — per lekcja (do obliczania zysku)
- **"Powtarzaj co tydzień"** — 2/4/8/12 tygodni lub **"Do odwołania"** (52 tygodnie)
- Edycja istniejących zajęć (kliknij na zajęty kafelek)
- Usuwanie zajęć

### 👨‍🏫 Korepetytorzy
- Dodawanie (imię, email, telefon)
- Lista z przyciskiem **"Link"** — kopiuje unikalny link rezerwacji
- Usuwanie

### 👨‍🎓 Uczniowie
- Dodawanie (imię, email, telefon, notatki)
- Lista uczniów
- Kliknięcie na ucznia → **historia zajęć** (daty, korepetytorzy, status płatności)
- Usuwanie

### 💰 Płatności
- Filtr po zakresie dat
- Podsumowanie: łącznie do zebrania, liczba zaległych, liczba rozliczonych
- Lista uczniów z zaległościami: kwota, przycisk **"Opłać wszystko"** (jeden klik)
- Przycisk **"SMS"** — wysyła przypomnienie o płatności
- Lista rozliczonych uczniów

### ✅ Obecność
- Wybór dnia
- Lista zajęć w tym dniu
- Przyciski **Obecny / Nieobecny** per zajęcia
- Toggle **"Zapłacone / Do zapłaty"** per zajęcia

### 📊 Raporty
- Filtr po zakresie dat
- **Godziny korepetytorów**: ile godzin, przychód od uczniów, koszt nauczyciela, **zysk**
- **Płatności uczniów**: kto ile zapłacił, kto ile ma do zapłaty
- Przycisk "Przypomnij" przy zaległościach

---

## 5. POWIADOMIENIA

| Typ | Kiedy | Kanał |
|---|---|---|
| Potwierdzenie rezerwacji | Korepetytor zarezerwuje slot | Email |
| Przypomnienie o zajęciach | Codziennie o 18:00, dzień przed | Email + SMS (uczeń i korepetytor) |
| Przypomnienie o płatności | Ręcznie przez admina | Email + SMS |

**Cron job**: `vercel.json` → `/api/cron/reminders` co dzień o 18:00 (gdy będzie deploy na Vercel)

---

## 6. PUBLICZNY WIDOK REZERWACJI

- URL: `http://localhost:3000/booking?link=XXXXX`
- Korepetytor otrzymuje unikalny link od admina
- Widzi dostępne sloty w kalendarzu
- Może zarezerwować slot wpisując imię ucznia
- Dostaje email z potwierdzeniem

---

## 7. CO DZIAŁA ✅

- [x] Logowanie do panelu admina (hasło: `admin123`)
- [x] Dodawanie/usuwanie korepetytorów
- [x] Dodawanie/usuwanie uczniów
- [x] Kalendarz z 6 salami
- [x] Dodawanie zajęć indywidualnych i grupowych
- [x] Powtarzające się zajęcia (do odwołania)
- [x] Stawka korepetytora per lekcja
- [x] Lista obecności
- [x] Historia zajęć ucznia
- [x] Płatności — opłać wszystko jednym kliknięciem
- [x] Raport godzin i zysku
- [x] SMS przez Twilio (skonfigurowany)
- [x] Email przez Resend (skonfigurowany)
- [x] Cron job (aktywny po deployu na Vercel)
- [x] **Deploy na Vercel** (działa online)
- [x] **Panel korepetytora** — login/hasło, siatka 6 sal, dodawanie własnych zajęć (bez kwot)
- [x] **Admin ustawia login/hasło korepetytora** (zakładka Korepetytorzy → "Hasło")
- [x] **Tagi zajęć** — rodzaj (kursy maturalne / indywidualne / grupowe) + przedmiot
- [x] **Kompleksowe raporty** — osobne hasło, per korepetytor / rodzaj / przedmiot, przychód+koszt+zysk, eksport CSV, druk PDF
- [x] **Widok tygodniowy** kalendarza (toggle Dzień/Tydzień)
- [x] **Kredyt ucznia** — przy usuwaniu lekcji opcja odliczenia nadpłaty od przyszłego rachunku
- [x] **SMS przez SMSAPI.pl** (migracja z Twilio) — nadawca `Test` (konto testowe), bez polskich znaków w treści (1 segment = taniej)
- [x] **Zajęcia cykliczne powiązane `series_id`** — usuwanie: tylko ta / ta i przyszłe / cały cykl
- [x] **Wykrywanie kolizji sal** (POST/PUT, admin i korepetytor)
- [x] **Dowolna godzina startu** (np. 12:30) — admin i korepetytor
- [x] **PWA** — instalowalna na telefonie, launcher na stronie głównej
- [x] **Responsywność mobilna** + naprawa niewidocznego tekstu w trybie ciemnym telefonu
- [x] **Historia zmian (audit log)** — zakładka Historia: kto/co/kiedy (dodanie/edycja/usunięcie zajęć)
- [x] **Naprawiony błąd:** POST lekcji gubił `lesson_type`/`subject`/`tutor_amount`/`is_group`

---

## 8. CO ZOSTAŁO DO ZROBIENIA ❌

### Zewnętrzne (czekają na właściciela)
- [ ] **Weryfikacja domeny Resend** — DKIM ✅ i SPF ✅ opublikowane; brakuje rekordu **MX** na `send` (`feedback-smtp.eu-west-1.amazonses.com.` z kropką, prio 10) w nazwa.pl. Po dodaniu → „Verify". W toku.
- [ ] **SMSAPI produkcyjnie** — wyjść z konta testowego (doładowanie) + zarejestrować nazwę nadawcy `BurzaMozgow`, zmienić `SMSAPI_SENDER`. W toku.

### Świadomie odpuszczone
- [x] ~~Powiadomienie przy odwołaniu zajęć~~ — decyzja: obsługuje sekretariat ręcznie
- [x] ~~Widok mobilny (agenda)~~ — obecny kalendarz wygodny na telefonie wg właściciela

### Niski priorytet / kiedyś
- [ ] **Osobne loginy** admin vs sekretarka (teraz wspólne hasło → w historii oboje jako „Administracja")
- [ ] **Synchronizacja z Google Calendar**

---

## 10. ZMIENNE ŚRODOWISKOWE

```env
NEXT_PUBLIC_SUPABASE_URL=https://rdrefgfzrifghetxrymw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@burza-mozgow-korepetycje.pl
SMSAPI_TOKEN=...                         # token OAuth z panelu SMSAPI
SMSAPI_SENDER=Test                       # nazwa nadawcy (docelowo: BurzaMozgow)
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
NEXT_PUBLIC_REPORTS_PASSWORD=admin1234   # osobne hasło do zakładki Raporty
CRON_SECRET=...
JWT_SECRET=...                           # sesje korepetytorów (panel /tutor)
```

> Te same zmienne muszą być dodane w **Vercel → Settings → Environment Variables**.
> Zmienne `TWILIO_*` są **już nieużywane** (migracja na SMSAPI) — można usunąć.

### Migracje SQL wykonane w Supabase
```sql
ALTER TABLE tutors   ADD COLUMN IF NOT EXISTS login TEXT UNIQUE;
ALTER TABLE tutors   ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE lessons  ADD COLUMN IF NOT EXISTS lesson_type TEXT;
ALTER TABLE lessons  ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE lessons  ADD COLUMN IF NOT EXISTS series_id UUID;
CREATE INDEX  IF NOT EXISTS idx_lessons_series ON lessons(series_id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS credit_balance NUMERIC DEFAULT 0;

-- Historia zmian (audit log)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  actor_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
```

---

## 11. URUCHAMIANIE LOKALNE

```bash
cd /Users/szymongodles/Claude/Projects/korepetycje-calendar
export PATH="/opt/homebrew/bin:$PATH"
npm run dev
# Aplikacja: http://localhost:3000
# Admin: http://localhost:3000/admin (hasło: admin123)
```
