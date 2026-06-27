'use client'

import { useState, useEffect } from 'react'
import { Lesson } from '@/lib/types'

interface GroupStudent { student_id: string; attendance: string | null; students?: { name: string } | null }
interface ReviewLesson extends Omit<Lesson, 'tutors' | 'students'> {
  tutors?: { name: string } | null
  students?: { name: string } | null
  lesson_students?: GroupStudent[]
}

const IND_LABEL: Record<string, { txt: string; cls: string }> = {
  present: { txt: 'Obecny', cls: 'bg-green-100 text-green-700' },
  absent: { txt: 'Nieobecny', cls: 'bg-red-100 text-red-700' },
  not_held: { txt: 'Nie odbyła się — do wyjaśnienia', cls: 'bg-amber-100 text-amber-800' },
}
const GRP_LABEL: Record<string, { txt: string; cls: string }> = {
  present: { txt: 'Obecny', cls: 'bg-green-100 text-green-700' },
  absent: { txt: 'Nieobecny', cls: 'bg-red-100 text-red-700' },
  na: { txt: 'Do wyjaśnienia', cls: 'bg-amber-100 text-amber-800' },
}

const ACTIONS: { id: string; label: string; cls: string }[] = [
  { id: 'paid', label: 'Płatna', cls: 'bg-green-600 hover:bg-green-700 text-white' },
  { id: 'unpaid', label: 'Niepłatna', cls: 'bg-gray-600 hover:bg-gray-700 text-white' },
  { id: 'credit', label: 'Dodaj kredyt', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { id: 'makeup', label: 'Do odrobienia', cls: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  { id: 'cancel', label: 'Anuluj lekcję', cls: 'bg-red-600 hover:bg-red-700 text-white' },
  { id: 'dismiss', label: 'Bez zmian', cls: 'border border-gray-300 text-gray-600 hover:bg-gray-50' },
]

export default function AttendanceReviewTab({ password }: { password: string }) {
  const [rows, setRows] = useState<ReviewLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/attendance-review', { headers })
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const act = async (lessonId: string, action: string) => {
    if (action === 'cancel' && !confirm('Anulować tę lekcję?')) return
    setBusy(lessonId)
    const res = await fetch('/api/admin/attendance-review', {
      method: 'POST', headers, body: JSON.stringify({ lesson_id: lessonId, action }),
    })
    if (res.ok) setRows(rows.filter(r => r.id !== lessonId))
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Obecność do sprawdzenia</h2>
        <button onClick={load} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">Odśwież</button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400 text-sm">Ładowanie...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center text-gray-400 text-sm">
          Brak zgłoszeń do sprawdzenia 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(l => {
            const ind = l.attendance_status ? IND_LABEL[l.attendance_status] : null
            return (
              <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {l.is_group ? 'Zajęcia grupowe' : (l.students?.name || '—')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(l.date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}{String(l.start_time).substring(0, 5)} · {l.room || '—'}
                      {l.subject ? ` · ${l.subject}` : ''} · {l.tutors?.name || '—'}
                    </p>
                  </div>
                  {ind && <span className={`shrink-0 text-xs px-2 py-1 rounded-md font-medium ${ind.cls}`}>{ind.txt}</span>}
                </div>

                {/* Grupa — statusy per uczeń */}
                {l.is_group && (l.lesson_students ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(l.lesson_students ?? []).map(s => {
                      const g = s.attendance ? GRP_LABEL[s.attendance] : null
                      return (
                        <span key={s.student_id} className={`text-xs px-2 py-1 rounded-md ${g?.cls || 'bg-gray-100 text-gray-500'}`}>
                          {s.students?.name || '—'}: {g?.txt || 'brak'}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Notatka korepetytora */}
                {l.attendance_note && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-900 mb-3">
                    <span className="font-medium">Notatka:</span> {l.attendance_note}
                  </div>
                )}
                {l.attendance_submitted_by && (
                  <p className="text-xs text-gray-400 mb-3">
                    Zgłosił: {l.attendance_submitted_by}
                    {l.attendance_submitted_at ? ` · ${new Date(l.attendance_submitted_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map(a => (
                    <button key={a.id} onClick={() => act(l.id, a.id)} disabled={busy === l.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${a.cls}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
