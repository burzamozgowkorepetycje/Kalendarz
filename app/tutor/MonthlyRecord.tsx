'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import MonthlyRecordTable, { MonthlyRecordData } from '@/app/components/MonthlyRecordTable'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyRecord() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<MonthlyRecordData | null>(null)
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/tutor/monthly-record?month=${month}`)
    if (res.ok) {
      setData(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Błąd ładowania')
    }
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const handleApprove = async () => {
    if (!data) return
    if (!confirm(`Zatwierdzić ewidencję za ${month}? Po zatwierdzeniu miesiąc jest oznaczony jako zaakceptowany przez Ciebie.`)) return
    setApproving(true)
    const res = await fetch('/api/tutor/monthly-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    })
    setApproving(false)
    if (res.ok) await load()
    else alert('Nie udało się zatwierdzić miesiąca')
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="text-lg font-bold text-gray-900">Miesięczna ewidencja pracy i wynagrodzenia</h2>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {loading && !data ? (
        <p className="px-4 py-8 text-center text-gray-400 text-sm">Ładowanie...</p>
      ) : data ? (
        <>
          <div className="print:hidden">
            {data.approval.approved ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-3">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>
                  Zatwierdzone przez Ciebie{data.approval.approved_at ? ` — ${new Date(data.approval.approved_at).toLocaleString('pl-PL')}` : ''}.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                <span>Ewidencja za ten miesiąc nie została jeszcze przez Ciebie zatwierdzona.</span>
                <button onClick={handleApprove} disabled={approving}
                  className="flex items-center gap-1.5 shrink-0 bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">
                  {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Zatwierdź miesiąc
                </button>
              </div>
            )}
          </div>

          <MonthlyRecordTable data={data} />
        </>
      ) : null}
    </div>
  )
}
