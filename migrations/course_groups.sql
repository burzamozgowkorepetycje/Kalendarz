-- Grupy jako osobny byt: rezerwują miejsce w grafiku niezależnie od tego,
-- ilu uczniów jest już do nich przypisanych.
CREATE TABLE IF NOT EXISTS course_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                       -- np. "Matura R - Matematyka - grupa 1"
  subject TEXT NOT NULL,
  level TEXT,                               -- 'podstawowa' | 'rozszerzona' | NULL
  is_maturzysta BOOLEAN DEFAULT false,
  is_e8 BOOLEAN DEFAULT false,
  location TEXT NOT NULL DEFAULT 'Wyszków', -- 'Wyszków' | 'Online'
  duration_minutes INTEGER DEFAULT 60,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_groups_active ON course_groups(active);
