-- Brakujące kolumny używane przez kod, nieobecne w supabase-schema.sql / migrations/*.sql
-- (prawdopodobnie dodane wcześniej ręcznie w Supabase dashboard i nie zapisane w repo)

ALTER TABLE course_groups ADD COLUMN IF NOT EXISTS tutor_id uuid REFERENCES tutors(id);

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS attendance_status text CHECK (attendance_status IN ('present','absent','not_held')),
  ADD COLUMN IF NOT EXISTS attendance_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_submitted_by text,
  ADD COLUMN IF NOT EXISTS attendance_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_note text,
  ADD COLUMN IF NOT EXISTS attendance_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_makeup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS count_toward_earnings boolean NOT NULL DEFAULT true;
