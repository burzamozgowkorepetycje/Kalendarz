-- Miesieczna ewidencja pracy i wynagrodzenia korepetytora
-- Zatwierdzenie miesiaca przez korepetytora ("zatwierdzone przez korepetytora")
create table if not exists tutor_monthly_approvals (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  month text not null, -- format 'YYYY-MM'
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tutor_id, month)
);

-- Korekty dnia wprowadzane przez admina (reczna zmiana kwoty za dany dzien + notatka uzasadniajaca)
create table if not exists tutor_day_adjustments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors(id) on delete cascade,
  date date not null,
  note text not null,
  amount_adjustment numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tutor_id, date)
);
