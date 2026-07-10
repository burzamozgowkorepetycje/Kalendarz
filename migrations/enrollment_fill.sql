-- Długość zajęć per zapis + identyfikator grupy (do liczenia wypełnienia lokalu)
ALTER TABLE student_enrollments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE student_enrollments ADD COLUMN IF NOT EXISTS group_name TEXT;  -- nazwa grupy; uczniowie z tą samą nazwą = jedna sala
