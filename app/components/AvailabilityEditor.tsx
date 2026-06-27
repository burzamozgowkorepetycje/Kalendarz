'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export interface Slot { weekday: number; start_time: string; end_time: string }

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

interface DayState { enabled: boolean; start: string; end: string }

export default function AvailabilityEditor({
  title,
  load,
  save,
  onClose,
}: {
  title: string
  load: () => Promise<Slot[]>
  save: (slots: Slot[]) => Promise<{ ok: boolean; error?: string }>
  onClose: () => void
}) {
  const [days, setDays] = useState<DayState[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, start: '15:00', end: '20:00' }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load().then(slots => {
      const next = Array.from({ length: 7 }, () => ({ enabled: false, start: '15:00', end: '20:00' }))
      for (const s of slots ?? []) {
        if (s.weekday >= 0 && s.weekday <= 6) {
          next[s.weekday] = { enabled: true, start: String(s.start_time).substring(0, 5), end: String(s.end_time).substring(0, 5) }
        }
      }
      setDays(next)
      setLoading(false)
    })
  }, [load])

  const update = (i: number, patch: Partial<DayState>) => {
    setDays(prev => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)))
    setSaved(false)
  }

  const handleSave = async () => {
    setError('')
    // walidacja: koniec po początku
    for (let i = 0; i < 7; i++) {
      if (days[i].enabled && days[i].end <= days[i].start) {
        setError(`${DAYS[i]}: godzina końca musi być po godzinie początku`)
        return
      }
    }
    setSaving(true)
    const slots: Slot[] = days
      .map((d, i) => ({ weekday: i, start_time: d.start, end_time: d.end, enabled: d.enabled }))
      .filter(d => d.enabled)
      .map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time }))
    const res = await save(slots)
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(onClose, 800)
    } else {
      setError(res.error || 'Błąd zapisu')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Ładowanie...</p>
          ) : (
            days.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={d.enabled}
                    onChange={e => update(i, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className={`text-sm ${d.enabled ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{DAYS[i]}</span>
                </label>
                {d.enabled ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input type="time" step={300} value={d.start}
                      onChange={e => update(i, { start: e.target.value })}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    <span className="text-gray-400">–</span>
                    <input type="time" step={300} value={d.end}
                      onChange={e => update(i, { end: e.target.value })}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 flex-1">niedostępny</span>
                )}
              </div>
            ))
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-sm text-green-600 font-medium text-center">Zapisano ✓</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Zapisywanie...' : 'Zapisz grafik'}
          </button>
        </div>
      </div>
    </div>
  )
}
