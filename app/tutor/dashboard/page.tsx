'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, LogOut, CalendarDays } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Student {
  id: string
  name: string
}

interface Lesson {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  room: string
  status: string
  students?: { name: string } | null
}

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6']
const DURATIONS = [30, 60, 90, 120]
const HOURS = Array.from({ length: 25 }, (_, i) => {
  const h = 8 + Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(t => {
  const [h] = t.split(':').map(Number)
  return h < 21
})

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function TutorDashboard() {
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: today(),
    start_time: '08:00',
    duration_minutes: 60,
    room: 'Sala 1',
    student_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchLessons = useCallback(async () => {
    const res = await fetch('/api/tutor/lessons')
    if (res.status === 401) { router.push('/tutor/login'); return }
    const data = await res.json()
    setLessons(Array.isArray(data) ? data : [])
  }, [router])

  useEffect(() => {
    const init = async () => {
      await fetchLessons()
      const res = await fetch('/api/tutor/students')
      if (res.ok) setStudents(await res.json())
      setLoading(false)
    }
    init()
  }, [fetchLessons])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.student_id) { setError('Wybierz ucznia'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/tutor/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      await fetchLessons()
      setShowForm(false)
      setForm({ date: today(), start_time: '08:00', duration_minutes: 60, room: 'Sala 1', student_id: '' })
    } else {
      setError(data.error || 'Błąd zapisu')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć zajęcia?')) return
    const res = await fetch(`/api/tutor/lessons?id=${id}`, { method: 'DELETE' })
    if (res.ok) setLessons(lessons.filter(l => l.id !== id))
  }

  const handleLogout = async () => {
    await fetch('/api/tutor/auth', { method: 'DELETE' })
    router.push('/tutor/login')
  }

  const upcoming = lessons.filter(l => l.date >= today())
  const past = lessons.filter(l => l.date < today())

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Ładowanie...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">Moje zajęcia</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700"
          >
            <Plus size={16} /> Dodaj zajęcia
          </button>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Add form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Nowe zajęcia</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Godzina</label>
                  <select
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Czas trwania</label>
                  <select
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
                  <select
                    value={form.room}
                    onChange={e => setForm({ ...form, room: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
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
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Zapisywanie...' : 'Zapisz zajęcia'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upcoming lessons */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-600">Nadchodzące zajęcia ({upcoming.length})</span>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Brak zaplanowanych zajęć</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcoming.map(lesson => (
                <LessonRow key={lesson.id} lesson={lesson} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        {/* Past lessons */}
        {past.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Historia ({past.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {past.slice().reverse().map(lesson => (
                <LessonRow key={lesson.id} lesson={lesson} onDelete={handleDelete} past />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LessonRow({ lesson, onDelete, past }: { lesson: Lesson; onDelete: (id: string) => void; past?: boolean }) {
  const date = new Date(lesson.date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className={`px-6 py-4 flex items-center justify-between ${past ? 'opacity-60' : ''}`}>
      <div>
        <p className="font-medium text-gray-900">{lesson.students?.name || '—'}</p>
        <p className="text-sm text-gray-500">{date} · {lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)} · {lesson.room} · {lesson.duration_minutes} min</p>
      </div>
      {!past && (
        <button
          onClick={() => onDelete(lesson.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}
