'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import { Student, Lesson } from '@/lib/types'

export default function StudentsTab({ password }: { password: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [history, setHistory] = useState<Lesson[]>([])
  const [form, setForm] = useState<{ name: string; email: string; phone: string; notes: string }>({ name: '', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  useEffect(() => {
    fetch('/api/admin/students', { headers }).then(r => r.json()).then(setStudents)
  }, [])

  const loadHistory = async (student: Student) => {
    setSelectedStudent(student)
    const res = await fetch(`/api/admin/lessons?student_id=${student.id}`, { headers })
    const data = await res.json()
    setHistory(data)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers,
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const s = await res.json()
      setStudents([s, ...students])
      setForm({ name: '', email: '', phone: '', notes: '' })
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Usunąć ucznia?')) return
    const res = await fetch(`/api/admin/students?id=${id}`, { method: 'DELETE', headers })
    if (res.ok) {
      setStudents(students.filter(s => s.id !== id))
      if (selectedStudent?.id === id) setSelectedStudent(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={18} /> Dodaj ucznia</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input required placeholder="Imię i nazwisko" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email (opcj.)" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Telefon (+48...)" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Notatki" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={loading}
            className="md:col-span-4 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Dodawanie...' : 'Dodaj ucznia'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Students list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-600">Uczniowie ({students.length})</span>
          </div>
          {students.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Brak uczniów</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {students.map(s => (
                <div key={s.id}
                  className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${selectedStudent?.id === s.id ? 'bg-blue-50' : ''}`}
                  onClick={() => loadHistory(s)}>
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.phone || s.email || 'brak kontaktu'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={e => { e.stopPropagation(); loadHistory(s) }}
                      className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                      <BookOpen size={16} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-600">
              {selectedStudent ? `Historia: ${selectedStudent.name}` : 'Wybierz ucznia aby zobaczyć historię'}
            </span>
          </div>
          {!selectedStudent ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Kliknij na ucznia</p>
          ) : history.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Brak zajęć</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {history.map(lesson => (
                <div key={lesson.id} className="px-6 py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(lesson.date).toLocaleDateString('pl-PL')} · {lesson.start_time}
                      </p>
                      <p className="text-xs text-gray-500">{lesson.duration_minutes} min · {lesson.tutors?.name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        lesson.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {lesson.payment_status === 'paid' ? 'Zapłacone' : 'Do zapłaty'}
                      </span>
                      {lesson.amount_due && (
                        <p className="text-xs text-gray-600 mt-1">{lesson.amount_due} zł</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
