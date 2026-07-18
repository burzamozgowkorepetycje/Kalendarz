import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { getStaffRole } from '@/lib/auth'
import { fetchAssistantContext } from '@/lib/assistant-data'

// Model nadpisywalny przez env — bez zmian w kodzie przy zmianie cennika/modelu.
const ASSISTANT_MODEL = process.env.AI_ASSISTANT_MODEL || 'claude-sonnet-4-5'

const SYSTEM_PROMPT = `Jesteś asystentem AI dla sekretariatu szkoły korepetycji. Odpowiadasz WYŁĄCZNIE na
podstawie danych przekazanych w kontekście poniżej (uczniowie, korepetytorzy, grupy, zapisy,
harmonogram lekcji). Nie masz dostępu do żadnych innych danych.

Twarde zasady:
- Nie masz dostępu do stawek, wynagrodzeń, marży ani żadnych danych finansowych — bo nigdy nie
  są one przekazywane do Twojego kontekstu. Jeśli ktoś zapyta o stawki, zarobki, ceny lub zysk,
  odpowiedz, że nie masz dostępu do danych finansowych i że taką informację może podać wyłącznie
  administrator w panelu.
- Tylko odpowiadasz i sugerujesz — NIE wykonujesz żadnych akcji, nie zapisujesz, nie zmieniasz
  danych. Jeśli użytkownik prosi o wykonanie zmiany (np. "zapisz ucznia", "usuń lekcję"), wyjaśnij,
  że na razie możesz tylko doradzić, a zmianę trzeba wykonać ręcznie w odpowiedniej zakładce panelu.
- Jeśli w przekazanym kontekście nie ma informacji potrzebnej do odpowiedzi, powiedz to wprost —
  nie zgaduj i nie wymyślaj danych.
- Odpowiadaj zwięźle, po polsku.`

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Brak klucza ANTHROPIC_API_KEY w env — poproś właściciela o konfigurację.' }, { status: 500 })
  }

  let question: string
  try {
    const body = await req.json()
    question = String(body?.question || '').trim()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 })
  }

  if (!question) return NextResponse.json({ error: 'Brak pytania' }, { status: 400 })
  if (question.length > 2000) return NextResponse.json({ error: 'Pytanie zbyt długie' }, { status: 400 })

  // Kontekst pobierany jest wyłącznie przez wąski, bezpieczny helper — patrz lib/assistant-data.ts.
  // Nigdy nie pobieramy tu ani nie przekazujemy do modelu kolumn finansowych.
  const context = await fetchAssistantContext(question)

  const client = new Anthropic()
  let answer: string

  try {
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Dane kontekstowe (JSON, tylko dane operacyjne, bez finansów):\n${JSON.stringify(context)}\n\nPytanie sekretariatu: ${question}`,
        },
      ],
    })

    const text = response.content.find((b) => b.type === 'text')?.text
    answer = text || 'Nie udało się uzyskać odpowiedzi.'
  } catch (err) {
    console.error('[assistant]', err)
    return NextResponse.json({ error: 'Błąd wywołania AI — spróbuj ponownie.' }, { status: 500 })
  }

  // Log Q&A do audytu. Nigdy nie logujemy danych finansowych — nie ma ich w
  // pytaniu/odpowiedzi, bo asystent nigdy ich nie widział ani nie mógł ich wygenerować.
  // Błąd zapisu logu nie powinien blokować zwrócenia odpowiedzi użytkownikowi.
  try {
    await supabaseAdmin.from('assistant_logs').insert({ role, question, answer })
  } catch (err) {
    console.error('[assistant] log write failed', err)
  }

  return NextResponse.json({ answer })
}
