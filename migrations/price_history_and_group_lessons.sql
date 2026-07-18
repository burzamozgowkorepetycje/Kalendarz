-- Historia zmian cen/stawek (uczniów i grup)
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'enrollment_price' | 'group_student_price' | 'group_tutor_rate'
  entity_id uuid NOT NULL,
  old_value numeric,
  new_value numeric,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_history_entity_idx ON price_history (entity_type, entity_id, changed_at DESC);

-- Powiązanie zajęć w kalendarzu ze zdefiniowaną grupą — pozwala liczyć realny zysk z faktycznie odbytych zajęć
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_group_id uuid REFERENCES course_groups(id);
