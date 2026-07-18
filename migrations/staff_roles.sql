-- Rozdzielenie roli administratora i sekretariatu.
--
-- Dotychczas panel admina mial jedno wspolne haslo (ADMIN_PASSWORD w env) bez pojecia
-- kont/uzytkownikow. Ta migracja dodaje tabele kont pracownikow z rola, zeby mozna bylo
-- zalozyc konto sekretariatu bez dostepu do stawek/wynagrodzen/zysku/raportow finansowych.
--
-- Logowanie administratora hasłem ADMIN_PASSWORD (env) dziala dalej bez zmian (rola 'admin').

CREATE TABLE IF NOT EXISTS staff_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'secretariat')) DEFAULT 'secretariat',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_accounts_active ON staff_accounts(active);
