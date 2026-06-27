'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardCheck, AlertTriangle, X, Check, UserX, HelpCircle, Users, User } from 'lucide-react'

interface GroupStudent { student_id: string; attendance: string | null; students?: { name: string } | null }
interface PendingLesson {
  id: string
  date: string
  start_time: string
  end_time: string
  room: string | null
  subject: string | null
  lesson_type: string | null
  is_group: boolean
  student_id: string | null
  students?: { name: string } | null
  lesson_students?: GroupStudent[]
}

type IndStatus = 'present' | 'absent' | 'not_held'
type GrpStatus = 'present' | 'absent' | 'na'

export default function AttendanceSection() {
  const [pending, setPending] = useState<PendingLesson[]>([])
  const [hasOverdue, setHasOverdue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<PendingLesson | null>(null)
  const [indStatus, setIndStatus] = useState<IndStatus | null>(null)
  const [grpStatus, setGrpStatus] = useState<Record<string, GrpStatus>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/tutor/attendance')
    if (res.ok) {
      const data = await res.json()
      setPending(data.pending ?? [])
      setHasOverdue(!!data.hasOverdue)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const todayStr = new Date().toISOString().split('T')[0]

  const openModal = (lesson: PendingLesson) => {
    setModal(lesson)
    setIndStatus(null)
    setNote('')
    setError('')
    if (lesson.is_group) {
      const init: Record<string, GrpStatus> = {}
      for (const s of lesson.lesson_students ?? []) init[s.student_id] = 'present'
      setGrpStatus(init)
    }
  }

  const studentLabel = (l: PendingLesson) =>
    l.is_group
      ? (l.lesson_students ?? []).map(s => s.students?.name).filter(Boolean).join(', ') || 'Grupa'
      : l.students?.name || '—'

  const typeLabel = (l: PendingLesson) =>
    l.lesson_type || (l.is_group ? 'Grupowe' : 'Indywidualne')

  const handleSave = async () => {
    if (!modal) return
    setError('')
    if (!modal.is_group) {
      if (!indStatus) { setError('Wybierz status obecności'); return }
      if (indStatus === 'not_held' && !note.trim()) { setError('Przy „nie odbyła się” notatka jest wymagana'); return }
    }
    setSaving(true)
    const body = modal.is_group
      ? { lesson_id: modal.id, group: Object.entries(grpStatus).map(([student_id, status]) => ({ student_id, status })), note }
      : { lesson_id: modal.id, status: indStatus, note }
    const res = await fetch('/api/tutor/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      setModal(null)
      setSuccess('Obecność zapisana ✓')
      setTimeout(() => setSuccess(''), 2500)
      await load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Błąd zapisu')
    }
  }

  if (loading) return null
  if (pending.length === 0 && !success) return null

  return (
    <div className="px-4 pt-4">
      {success && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2 text-center font-medium">
          {success}
        </div>
      )}

      {hasOverdue && (
        <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Masz nieuzupełnione obecności z poprzednich zajęć. Uzupełnij je, aby administracja mogła rozliczyć zajęcia.</span>
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Do uzupełnienia obecność: {pending.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {pending.map(l => (
              <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    {l.is_group ? <Users size={13} className="text-purple-500 shrink-0" /> : <User size={13} className="text-gray-400 shrink-0" />}
                    <span className="truncate">{studentLabel(l)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {l.date === todayStr ? 'Dziś' : new Date(l.date + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                    {' · '}{String(l.start_time).substring(0, 5)} · {l.room || '—'}
                    {l.subject ? ` · ${l.subject}` : ''} · {typeLabel(l)}
                  </p>
                </div>
                <button onClick={() => openModal(l)}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
                  Uzupełnij obecność
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900">Obecność</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-500">
                {modal.date === todayStr ? 'Dziś' : new Date(modal.date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}{String(modal.start_time).substring(0, 5)} · {modal.room || '—'}{modal.subject ? ` · ${modal.subject}` : ''}
              </p>

              {!modal.is_group ? (
                <div className="space-y-2">
                  <button onClick={() => setIndStatus('present')}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${indStatus === 'present' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700 hover:border-green-400'}`}>
                    <Check size={16} /> Obecny
                  </button>
                  <button onClick={() => setIndStatus('absent')}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${indStatus === 'absent' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700 hover:border-red-400'}`}>
                    <UserX size={16} /> Nieobecny / nie przyszedł
                  </button>
                  <button onClick={() => setIndStatus('not_held')}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${indStatus === 'not_held' ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-300 text-gray-700 hover:border-amber-400'}`}>
                    <HelpCircle size={16} /> Lekcja nie odbyła się — do wyjaśnienia
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => {
                    const all: Record<string, GrpStatus> = {}
                    for (const s of modal.lesson_students ?? []) all[s.student_id] = 'present'
                    setGrpStatus(all)
                  }} className="w-full px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">
                    Oznacz wszystkich jako obecnych
                  </button>
                  {(modal.lesson_students ?? []).map(s => (
                    <div key={s.student_id} className="border border-gray-200 rounded-lg p-2.5">
                      <p className="text-sm font-medium text-gray-900 mb-2">{s.students?.name || '—'}</p>
                      <div className="flex gap-1.5">
                        {([['present', 'Obecny'], ['absent', 'Nieobecny'], ['na', 'Do wyjaśnienia']] as [GrpStatus, string][]).map(([val, lbl]) => (
                          <button key={val} onClick={() => setGrpStatus(p => ({ ...p, [s.student_id]: val }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                              grpStatus[s.student_id] === val
                                ? val === 'present' ? 'bg-green-600 text-white border-green-600'
                                  : val === 'absent' ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-amber-600 text-white border-amber-600'
                                : 'border-gray-300 text-gray-600 hover:border-gray-400'
                            }`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notatka dla administracji</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Np. uczeń napisał, że nie przyjdzie, lekcja przełożona, problem z salą, spóźniony 20 min..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Zapisywanie...' : 'Zapisz obecność'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
