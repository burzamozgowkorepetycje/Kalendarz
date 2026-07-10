-- Zapisy uczniów na przedmioty (jeden uczeń może być zapisany na wiele przedmiotów)
CREATE TABLE IF NOT EXISTS student_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'individual',      -- 'individual' | 'group'
  location TEXT NOT NULL DEFAULT 'Wyszków',      -- 'Wyszków' | 'Online'
  is_maturzysta BOOLEAN DEFAULT false,
  is_e8 BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON student_enrollments(active);
CREATE INDEX IF NOT EXISTS idx_enrollments_cancelled ON student_enrollments(cancelled_at);
