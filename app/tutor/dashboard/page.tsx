'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, LogOut, User, Users, CalendarClock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AvailabilityEditor, { Slot } from '@/app/components/AvailabilityEditor'

interface Student { id: string; name: string }
interface CalendarLesson {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  room: string
  status: string
  is_group: boolean
  tutor_id: string | null
  student_id: string | null
  lesson_type: string | null
  subject: string | null
  tutors?: { name: string } | null
  students?: { name: string } | null
}

interface SlotModal { room: string; start_time: string; existing?: CalendarLesson }

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6']
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const DURATIONS = [30, 60, 90, 120]
const LESSON_TYPES = ['Kursy maturalne', 'Zajęcia indywidualne', 'Zajęcia grupowe']
const SUBJECTS = ['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS']

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }

export default function TutorDashboard() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [lessons, setLessons] = useState<CalendarLesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [myTutorId, setMyTutorId] = useState<string | null>(null)
  const [modal, setModal] = useState<SlotModal | null>(null)
  const [form, setForm] = useState({ student_id: '', duration_minutes: 60, lesson_type: '', subject: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingCal, setLoadingCal] = useState(false)
  const [showAvailability, setShowAvailability] = useState(false)

  const dateStr = toDateStr(currentDate)

  const fetchCalendar = useCallback(async (date: string) => {
    setLoadingCal(true)
    const res = await fetch(`/api/tutor/calendar?date=${date}`)
    if (res.status === 401) { router.push('/tutor/login'); return }
    const data = await res.json()
    setLessons(Array.isArray(data.lessons) ? data.lessons : [])
    setMyTutorId(data.tutorId || null)
    setLoadingCal(false)
  }, [router])

  useEffect(() => {
    fetch('/api/tutor/students').then(r => r.json()).then(d => setStudents(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { fetchCalendar(dateStr) }, [dateStr, fetchCalendar])

  // dopasowanie po "kubełku godzinowym" — lekcja 12:30 trafia do wiersza 12:00
  const getLessonForSlot = (hour: string, room: string) =>
    lessons.find(l => String(l.start_time ?? '').substring(0, 2) === hour.substring(0, 2) && l.room === room)

  const openSlot = (hour: string, room: string) => {
    const existing = getLessonForSlot(hour, room)
    if (existing && existing.tutor_id !== myTutorId) return // nie jego zajęcia — tylko podgląd już blokuje klik
    const startTime = existing ? String(existing.start_time).substring(0, 5) : hour
    setModal({ room, start_time: startTime, existing })
    setForm({ student_id: existing?.student_id || '', duration_minutes: existing?.duration_minutes || 60, lesson_type: existing?.lesson_type || '', subject: existing?.subject || '' })
    setError('')
  }

  const handleSave = async () => {
    if (!modal) return
    if (!form.student_id) { setError('Wybierz ucznia'); return }
    setSaving(true)
    setError('')

    const [h, m] = modal.start_time.split(':').map(Number)
    const total = h * 60 + m + form.duration_minutes
    const end_time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

    const res = await fetch('/api/tutor/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: dateStr,
        start_time: modal.start_time,
        end_time,
        duration_minutes: form.duration_minutes,
        room: modal.room,
        student_id: form.student_id,
        lesson_type: form.lesson_type || null,
        subject: form.subject || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      await fetchCalendar(dateStr)
      setModal(null)
    } else {
      setError(data.error || 'Błąd zapisu')
    }
  }

  const handleDelete = async () => {
    if (!modal?.existing) return
    await fetch(`/api/tutor/lessons?id=${modal.existing.id}`, { method: 'DELETE' })
    await fetchCalendar(dateStr)
    setModal(null)
  }

  const handleLogout = async () => {
    await fetch('/api/tutor/auth', { method: 'DELETE' })
    router.push('/tutor/login')
  }

  const prevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const nextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d) }
  const dayLabel = currentDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">Panel korepetytora</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAvailability(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <CalendarClock size={16} /> Dostępność
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <LogOut size={16} /> Wyloguj
          </button>
        </div>
      </div>

      {showAvailability && (
        <AvailabilityEditor
          title="Moja dostępność (grafik tygodniowy)"
          load={async () => {
            const r = await fetch('/api/tutor/availability')
            return r.ok ? (await r.json()) as Slot[] : []
          }}
          save={async (slots) => {
            const r = await fetch('/api/tutor/availability', {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slots }),
            })
            return { ok: r.ok, error: r.ok ? undefined : 'Błąd zapisu' }
          }}
          onClose={() => setShowAvailability(false)}
        />
      )}

      {/* Date nav */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={prevDay} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} className="text-gray-700" /></button>
        <div className="text-center">
          <p className="font-bold text-gray-900 capitalize">{dayLabel}</p>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-blue-600 hover:underline">Dziś</button>
        </div>
        <button onClick={nextDay} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} className="text-gray-700" /></button>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex items-center gap-4 text-xs text-gray-500 bg-white border-b border-gray-100">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" /> Moje zajęcia</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> Zajęte (innych)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-dashed border-gray-300 inline-block" /> Wolne — kliknij by się wpisać</span>
      </div>

      {/* Calendar grid */}
      <div className="p-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-16 px-3 py-3 text-left text-xs font-semibold text-gray-500">Godz.</th>
                {ROOMS.map(room => (
                  <th key={room} className="px-2 py-3 text-center text-xs font-semibold text-gray-700">{room}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap">{hour}</td>
                  {ROOMS.map(room => {
                    const lesson = getLessonForSlot(hour, room)
                    const isMine = lesson?.tutor_id === myTutorId

                    if (lesson) {
                      return (
                        <td key={room} className="px-1 py-1">
                          <button
                            onClick={() => isMine ? openSlot(hour, room) : undefined}
                            className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                              isMine
                                ? 'bg-blue-100 border border-blue-300 hover:bg-blue-200 cursor-pointer'
                                : lesson.is_group
                                ? 'bg-purple-50 border border-purple-200 cursor-default'
                                : 'bg-gray-100 border border-gray-200 cursor-default'
                            }`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              {lesson.is_group ? <Users size={10} className="text-purple-500 shrink-0" /> : <User size={10} className="text-gray-400 shrink-0" />}
                              <p className="font-semibold text-gray-800 truncate text-xs">
                                {isMine ? (lesson.students?.name || '—') : (lesson.tutors?.name || '—')}
                              </p>
                            </div>
                            <p className="text-gray-500 text-xs">{String(lesson.start_time).substring(0,5)} · {lesson.duration_minutes} min</p>
                          </button>
                        </td>
                      )
                    }

                    return (
                      <td key={room} className="px-1 py-1">
                        <button
                          onClick={() => openSlot(hour, room)}
                          className="w-full h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center group"
                        >
                          <Plus size={14} className="text-gray-300 group-hover:text-blue-500" />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {loadingCal && (
            <div className="text-center py-4 text-sm text-gray-400">Ładowanie...</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">{modal.room} · {modal.start_time}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Godzina rozpoczęcia</label>
                <input type="time" step={300} value={modal.start_time}
                  onChange={e => setModal({ ...modal, start_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Uczeń</label>
                <select
                  value={form.student_id}
                  onChange={e => setForm({ ...form, student_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— wybierz ucznia —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rodzaj zajęć</label>
                  <select value={form.lesson_type} onChange={e => setForm({ ...form, lesson_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">— wybierz —</option>
                    {LESSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Przedmiot</label>
                  <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">— wybierz —</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Czas trwania</label>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setForm({ ...form, duration_minutes: d })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        form.duration_minutes === d
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-gray-200">
              {modal.existing && (
                <button onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Usuń</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Zapisuję...' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
