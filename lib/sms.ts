// Wysyłka SMS przez SMSAPI.pl (REST API, token OAuth)
// Dokumentacja: https://www.smsapi.pl/docs

const SMSAPI_URL = 'https://api.smsapi.pl/sms.do'

/**
 * Normalizuje numer do formatu 48XXXXXXXXX (SMSAPI akceptuje 48xxx lub xxx).
 * Usuwa spacje, myślniki, nawiasy i wiodący plus.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  // jeśli 9 cyfr (krajowy bez prefiksu) — dodaj 48
  if (digits.length === 9) return `48${digits}`
  return digits
}

export interface SMSResult {
  ok: boolean
  error?: string
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  const token = process.env.SMSAPI_TOKEN
  const from = process.env.SMSAPI_SENDER || 'Test'

  if (!token) {
    const error = 'Brak konfiguracji SMSAPI_TOKEN na serwerze'
    console.error('SMS error:', error)
    return { ok: false, error }
  }

  const params = new URLSearchParams({
    to: normalizePhone(to),
    message,
    from,
    format: 'json',
    encoding: 'utf-8',
  })

  try {
    const res = await fetch(SMSAPI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await res.json()

    // SMSAPI zwraca { error, message } przy błędzie, { count, list } przy sukcesie
    if (data.error) {
      const error = `SMSAPI ${data.error}: ${data.message || 'błąd wysyłki'}`
      console.error('SMS error:', error)
      return { ok: false, error }
    }

    return { ok: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'nieznany błąd sieci'
    console.error('SMS error:', msg)
    return { ok: false, error: msg }
  }
}
