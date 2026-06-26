# Setup Aplikacji Korepetycje Calendar

## 1. Supabase Setup

### Krok 1: Utwórz konto na Supabase
1. Idź na https://supabase.com
2. Utwórz nowy projekt
3. Czekaj aż projekt będzie gotowy

### Krok 2: Utwórz tabele

Idź do `SQL Editor` w Supabase i uruchom to SQL:

```sql
-- Create tutors table
CREATE TABLE tutors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  unique_link TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Create time_slots table
CREATE TABLE time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  tutor_id UUID REFERENCES tutors(id) ON DELETE SET NULL,
  student_name TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'cancelled')),
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_time_slots_status ON time_slots(status);
CREATE INDEX idx_time_slots_date ON time_slots(date);
CREATE INDEX idx_tutors_link ON tutors(unique_link);
```

### Krok 3: Skopiuj klucze

1. Idź do `Settings > API` w Supabase
2. Skopiuj:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

3. Wklej do `.env.local`

## 2. Resend Setup (Email)

### Krok 1: Utwórz konto na Resend
1. Idź na https://resend.com
2. Utwórz konto
3. Weź API Key ze Settings

### Krok 2: Dodaj do `.env.local`
```
RESEND_API_KEY=your_api_key_here
```

## 3. Admin Password

Ustaw hasło do panelu admina:

```
ADMIN_PASSWORD=twoje_mocne_haslo
NEXT_PUBLIC_ADMIN_PASSWORD=twoje_mocne_haslo
```

## 4. Uruchom aplikację

```bash
npm run dev
```

App będzie dostępna na http://localhost:3000

## 5. Użycie

### Admin Panel: http://localhost:3000/admin
- Zaloguj się hasłem
- Dodaj korepetytorów
- Skopiuj linki rezerwacji dla każdego

### Rezerwacja: http://localhost:3000/booking?link=XXXXX
- Korepetytorzy otrzymują unikalny link
- Rezerwują swoją lekcję
- Otrzymują email potwierdzający

## Zmienne środowiska (.env.local)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Resend
RESEND_API_KEY=re_XXXX...

# Admin
ADMIN_PASSWORD=twoje_haslo
NEXT_PUBLIC_ADMIN_PASSWORD=twoje_haslo
```
