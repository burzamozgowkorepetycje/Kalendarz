'use client'

import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'

interface Message {
  question: string
  answer: string
}

export default function AssistantTab({ password }: { password: string }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Błąd')
      } else {
        setMessages((prev) => [...prev, { question: q, answer: data.answer }])
        setQuestion('')
      }
    } catch {
      setError('Błąd połączenia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-blue-600" />
        <h2 className="text-lg font-bold text-gray-800">Asystent AI dla sekretariatu</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Zadaj pytanie o uczniów, harmonogram, grupy lub korepetytorów (dane kontaktowe). Asystent tylko
        odpowiada i doradza — nie wprowadza żadnych zmian, a stawki i zarobki nie są mu dostępne.
      </p>

      <div className="space-y-4 mb-4 max-h-[55vh] overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 italic">Brak pytań w tej sesji. Zapytaj np. „Kiedy ma zajęcia Jan Kowalski?”.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <div className="bg-blue-50 text-blue-900 rounded-lg px-3 py-2 text-sm self-end ml-auto max-w-[85%]">
              {m.question}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 max-w-[85%] whitespace-pre-wrap">
              {m.answer}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Zadaj pytanie…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-1"
        >
          <Send size={16} />
          {loading ? '...' : 'Wyślij'}
        </button>
      </form>
    </div>
  )
}
