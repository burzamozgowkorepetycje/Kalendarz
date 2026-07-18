ALTER TABLE course_groups ADD COLUMN IF NOT EXISTS tutor_id uuid REFERENCES tutors(id);
