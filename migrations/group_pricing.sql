ALTER TABLE course_groups ADD COLUMN IF NOT EXISTS tutor_rate_per_hour numeric DEFAULT 0;
ALTER TABLE course_groups ADD COLUMN IF NOT EXISTS student_price numeric;
ALTER TABLE student_enrollments ADD COLUMN IF NOT EXISTS price numeric;
