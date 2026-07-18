// Minimalny test warstwy scopingu danych asystenta AI (bez frameworka testowego —
// repo nie ma skonfigurowanego vitest/jest, więc używamy wbudowanego node:test).
// Uruchomienie: node --test lib/assistant-data.test.mjs
// (transpilowana ręcznie kopia logiki z assistant-data.ts, bo repo nie ma
// jeszcze pipeline'u do uruchamiania testów TS bez kompilacji — patrz uwaga w raporcie)
import { test } from 'node:test'
import assert from 'node:assert/strict'

const ASSISTANT_SAFE_COLUMNS = {
  students: ['id', 'name', 'email', 'phone', 'notes', 'birth_date', 'grade', 'location', 'status', 'created_at'],
  tutors: ['id', 'name', 'email', 'phone', 'meet_link', 'subjects', 'works_online', 'works_onsite', 'active'],
  course_groups: ['id', 'name', 'subject', 'level', 'is_maturzysta', 'is_e8', 'location', 'duration_minutes', 'active', 'tutor_id'],
  student_enrollments: ['id', 'student_id', 'subject', 'mode', 'location', 'is_maturzysta', 'is_e8', 'active', 'cancelled_at', 'created_at'],
  lessons: ['id', 'date', 'start_time', 'end_time', 'duration_minutes', 'tutor_id', 'student_id', 'status', 'location', 'is_group', 'subject', 'course_group_id'],
}

const FINANCIAL_FIELDS = ['amount_due', 'tutor_amount', 'hourly_rate', 'rate_individual', 'rate_pair', 'rate_group', 'tutor_rate_per_hour', 'student_price', 'price', 'old_value', 'new_value', 'credit_balance']

test('assistant safe-column allowlist never contains a financial field', () => {
  for (const [table, cols] of Object.entries(ASSISTANT_SAFE_COLUMNS)) {
    for (const f of FINANCIAL_FIELDS) {
      assert.ok(!cols.includes(f), `${table} allowlist leaks financial field ${f}`)
    }
  }
})
