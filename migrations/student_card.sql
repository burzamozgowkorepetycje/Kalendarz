-- Rozszerzenie karty ucznia o dane podstawowe
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade TEXT;               -- klasa
ALTER TABLE students ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Wyszków';  -- miejscowość / Online
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'potencjalny'; -- potencjalny/zapisany/aktywny/zawieszony/zakończył
