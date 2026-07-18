-- Log pytan i odpowiedzi asystenta AI dla sekretariatu (audyt/przeglad).
-- Nigdy nie zapisujemy tu danych finansowych — asystent nie ma do nich dostepu,
-- wiec nie powinny sie tu pojawic; kolumny sa czysto tekstowe (pytanie/odpowiedz).

CREATE TABLE IF NOT EXISTS assistant_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id TEXT,                      -- id konta z staff_accounts, lub 'admin' dla logowania hasłem właściciela
  role TEXT NOT NULL,                 -- 'admin' | 'secretariat' — rola pytającego w momencie zapytania
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_logs_created ON assistant_logs(created_at);
