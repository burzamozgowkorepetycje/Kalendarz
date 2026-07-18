'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Plus } from 'lucide-react'
import MonthlyRecordTable, { MonthlyRecordData } from '@/app/components/MonthlyRecordTable'

interface TutorOption { id: string; name: string }

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Widok admina: miesieczna ewidencja pracy i wynagrodzenia dowolnego korepetytora.
// Reuzywa te sama logike agregacji co /api/tutor/monthly-record (lib/tutorMonthlyRecord.ts),
// zeby liczby byly zawsze spojne z widokiem korepetytora i z rozliczeniem w ReportsTab.
export default function MonthlyRecordTab({ password }: { password: string }) {
  const [tutors, setTutors] = useState<TutorOption[]>([])
  const [tutorId, setTutorId] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<MonthlyRecordData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [adjOpen, setAdjOpen] = useState<string | null>(null) // date being adjusted
  const [adjNote, setAdjNote] = useState('')
  const [adjAmount, setAdjAmount] = useState('0')
  const [savingAdj, setSavingAdj] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  useEffect(() => {
    fetch('/api/admin/tutors', { headers: { Authorization: `Bearer ${password}` } })
      .then(r => r.json())
      .then(d => {
        const list = (Array.isArray(d) ? d : d.tutors || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
        setTutors(list)
        if (list.length > 0) setTutorId(prev => prev || list[0].id)
      })
      .catch(() => {})
  }, [password])

  const load = useCallback(async () => {
    if (!tutorId) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/monthly-record?tutor_id=${tutorId}&month=${month}`, { headers })
    if (res.ok) {
      setData(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Błąd ładowania')
      setData(null)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, month, password])

  useEffect(() => { load() }, [load])

  const openAdjustment = (date: string) => {
    const existing = data?.days.find(d => d.date === date)
    setAdjOpen(date)
    setAdjNote(existing?.adjustmentNote || '')
    setAdjAmount(String(existing?.adjustment ?? 0))
  }

  const saveAdjustment = async () => {
    if (!adjOpen || !tutorId) return
    if (!adjNote.trim()) { alert('Podaj uzasadnienie korekty'); return }
    setSavingAdj(true)
    const res = await fetch('/api/admin/monthly-record', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tutor_id: tutorId, date: adjOpen, note: adjNote, amount_adjustment: Number(adjAmount) || 0 }),
    })
    setSavingAdj(false)
    if (res.ok) {
      setAdjOpen(null)
      await load()
    } else {
      alert('Nie udało się zapisać korekty')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Korepetytor</label>
          <select value={tutorId} onChange={e => setTutorId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 min-w-[200px]">
            {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Miesiąc</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
        </div>
        {data && (
          <div className="ml-auto">
            {data.approval.approved ? (
              <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 size={16} /> Zatwierdzone przez korepetytora
                {data.approval.approved_at ? ` (${new Date(data.approval.approved_at).toLocaleDateString('pl-PL')})` : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <XCircle size={16} /> Niezatwierdzone przez korepetytora
              </span>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      {loading && !data ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
          <p className="text-gray-400 text-sm">Ładowanie...</p>
        </div>
      ) : data ? (
        <>
          <MonthlyRecordTable data={data} />

          {/* Korekty dnia — admin moze dodac/zmienic korekte dla dowolnego dnia w miesiacu */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
            <p className="text-sm font-semibold text-gray-700 mb-3">Korekta dnia (ręczna zmiana kwoty + notatka)</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input type="date" min={`${month}-01`} max={`${month}-31`}
                  value={adjOpen || ''} onChange={e => openAdjustment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>
              {adjOpen && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Kwota korekty (zł, może być ujemna)</label>
                    <input type="number" step="0.01" value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 w-32" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Uzasadnienie</label>
                    <input type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)}
                      placeholder="np. korekta za nieprawidłowo naliczoną stawkę"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                  </div>
                  <button onClick={saveAdjustment} disabled={savingAdj}
                    className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    <Plus size={15} /> Zapisz korektę
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
