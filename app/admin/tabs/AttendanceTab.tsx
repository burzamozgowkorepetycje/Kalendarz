'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { Lesson } from '@/lib/types'

export default function AttendanceTab({ password }: { password: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  useEffect(() => { loadLessons() }, [date])

  const loadLessons = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/lessons?from=${date}&to=${date}`, { headers })
    const data = await res.json()
    setLessons(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const updateLesson = async (id: string, fields: Partial<Lesson>) => {
    const res = await fetch('/api/admin/lessons', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ id, ...fields }),
    })
    if (res.ok) {
      setLessons(lessons.map(l => l.id === id ? { ...l, ...fields } : l))
    }
  }

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wybierz dzień</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="text-sm text-gray-500 mt-5">
            {lessons.length} zajęć w tym dniu
          </div>
        </div>
      </div>

      {/* Lessons list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-600">Lista obecności</span>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">Ładowanie...</p>
        ) : lessons.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">Brak zajęć w tym dniu</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lessons.map(lesson => (
              <div key={lesson.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{lesson.students?.name ?? '—'}</p>
                    <p className="text-sm text-gray-500">
                      {lesson.start_time} · {lesson.duration_minutes} min · {lesson.tutors?.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Attendance */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateLesson(lesson.id, { attendance: 'present', status: 'completed' })}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          lesson.attendance === 'present'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                        }`}>
                        <CheckCircle size={14} /> Obecny
                      </button>
                      <button
                        onClick={() => updateLesson(lesson.id, { attendance: 'absent' })}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          lesson.attendance === 'absent'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600'
                        }`}>
                        <XCircle size={14} /> Nieobecny
                      </button>
                    </div>

                    {/* Payment */}
                    <button
                      onClick={() => updateLesson(lesson.id, {
                        payment_status: lesson.payment_status === 'paid' ? 'unpaid' : 'paid'
                      })}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        lesson.payment_status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                      }`}>
                      <Clock size={14} />
                      {lesson.payment_status === 'paid' ? 'Zapłacone' : 'Do zapłaty'}
                      {lesson.amount_due ? ` · ${lesson.amount_due} zł` : ''}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
