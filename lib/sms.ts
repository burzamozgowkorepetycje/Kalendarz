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

export async function sendSMS(to: string, message: string) {
  const token = process.env.SMSAPI_TOKEN
  const from = process.env.SMSAPI_SENDER || 'Test'

  if (!token) {
    console.error('SMS error: brak SMSAPI_TOKEN')
    return
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
      console.error(`SMS error [SMSAPI ${data.error}]:`, data.message)
    }
  } catch (error) {
    console.error('SMS error:', error)
  }
}
