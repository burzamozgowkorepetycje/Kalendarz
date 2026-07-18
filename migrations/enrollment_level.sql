-- Poziom matury per zapis (podstawowa / rozszerzona), niezależny per przedmiot
ALTER TABLE student_enrollments ADD COLUMN IF NOT EXISTS level TEXT; -- 'podstawowa' | 'rozszerzona' | NULL (dla E8 / nie dotyczy)
