# PROJECT STATUS — Korepetycje Calendar
_Ostatnia aktualizacja: 2026-06-26_

---

## 1. STOS TECHNOLOGICZNY

| Warstwa | Technologia |
|---|---|
| Frontend + Backend | Next.js 16 (App Router, TypeScript) |
| Stylowanie | Tailwind CSS |
| Baza danych | Supabase (PostgreSQL) |
| Email | Resend |
| SMS | Twilio |
| Hosting (docelowy) | Vercel |
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

---

## 8. CO ZOSTAŁO DO ZROBIENIA ❌

### Wysoki priorytet
- [ ] **Deploy na Vercel** — aplikacja działa tylko lokalnie, nie jest dostępna online
- [ ] **Weryfikacja domeny w Resend** — aktualnie emaile mogą trafić do spamu (brak własnej domeny)
- [ ] **Weryfikacja numeru Twilio** — trial pozwala wysyłać SMS tylko na zweryfikowane numery

### Średni priorytet
- [ ] **Widok tygodniowy w kalendarzu** — aktualnie tylko widok dzienny
- [ ] **Eksport do PDF/Excel** — raporty można tylko przeglądać, nie można eksportować
- [ ] **Powiadomienie przy zmianie/odwołaniu zajęć** — aktualnie tylko przy rezerwacji
- [ ] **Historia zmian zajęć** — audit log (kto co zmienił)
- [ ] **Możliwość anulowania pojedynczych zajęć z cyklu** bez usuwania całego cyklu

### Niski priorytet
- [ ] **Logowanie korepetytorów** — aktualnie dostają tylko link, nie mają konta
- [ ] **Panel korepetytora** — podgląd własnych zajęć i historii
- [ ] **Synchronizacja z Google Calendar** — opcjonalny eksport do GCal
- [ ] **Aplikacja mobilna** — aktualnie tylko przeglądarka

---

## 9. NASTĘPNE KROKI (sugerowana kolejność)

1. **Deploy na Vercel** (15 min)
   - `git init && git add . && git commit -m "init"`
   - Push na GitHub
   - Import na vercel.com
   - Dodać zmienne środowiskowe z `.env.local`

2. **Weryfikacja domeny Resend** (10 min)
   - Dodać domenę na resend.com
   - Dodać rekordy DNS
   - Zmienić `RESEND_FROM_EMAIL` w `.env.local`

3. **Odblokowanie SMS Twilio** (5 min)
   - W Twilio trial → zweryfikować numery odbiorców
   - Lub upgrade konta dla produkcji

4. **Widok tygodniowy** — opcjonalnie po deployu

---

## 10. ZMIENNE ŚRODOWISKOWE

```env
NEXT_PUBLIC_SUPABASE_URL=https://rdrefgfzrifghetxrymw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@korepetycje.pl
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+16093228635
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
CRON_SECRET=...
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
