'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, RefreshCw, Users, User, Trash2 } from 'lucide-react'
import { Tutor, Student, Lesson, LessonStudent } from '@/lib/types'

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6']
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const DURATIONS = [30, 60, 90, 120]
const REPEAT_OPTIONS = [{ label: '2 tyg.', value: 2 }, { label: '4 tyg.', value: 4 }, { label: '8 tyg.', value: 8 }, { label: '12 tyg.', value: 12 }, { label: 'Do odwołania', value: 52 }]
const LESSON_TYPES = ['Kursy maturalne', 'Zajęcia indywidualne', 'Zajęcia grupowe']
const SUBJECTS = ['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS']

interface SlotModal { date: string; room: string; start_time: string; lesson?: Lesson }
interface GroupEntry { student_id: string; amount_due: string }

export default function CalendarTab({ password }: { password: string }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [modal, setModal] = useState<SlotModal | null>(null)
  const [lessonStudents, setLessonStudents] = useState<LessonStudent[]>([])
  const [form, setForm] = useState({
    tutor_id: '',
    student_id: '',
    duration_minutes: '60',
    amount_due: '',
    tutor_amount: '',
    is_group: false,
    repeat: false,
    repeat_weeks: '4',
    lesson_type: '',
    subject: '',
  })
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([{ student_id: '', amount_due: '' }])
  const [saving, setSaving] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }
  const dateStr = currentDate.toISOString().split('T')[0]

  useEffect(() => {
    fetch('/api/admin/tutors', { headers }).then(r => r.json()).then(setTutors)
    fetch('/api/admin/students', { headers }).then(r => r.json()).then(setStudents)
  }, [])

  useEffect(() => { loadLessons() }, [dateStr])

  const loadLessons = async () => {
    const res = await fetch(`/api/admin/lessons?from=${dateStr}&to=${dateStr}`, { headers })
    const data = await res.json()
    setLessons(Array.isArray(data) ? data : [])
  }

  const getLessonForSlot = (hour: string, room: string) =>
    lessons.find(l => l.start_time?.substring(0, 5) === hour && l.room === room)

  const openModal = async (hour: string, room: string) => {
    const existing = getLessonForSlot(hour, room)
    setModal({ date: dateStr, room, start_time: hour, lesson: existing })
    if (existing) {
      setForm({
        tutor_id: existing.tutor_id || '',
        student_id: existing.student_id || '',
        duration_minutes: String(existing.duration_minutes),
        amount_due: String(existing.amount_due || ''),
        tutor_amount: String(existing.tutor_amount || ''),
        is_group: existing.is_group,
        repeat: false,
        repeat_weeks: '4',
        lesson_type: existing.lesson_type || '',
        subject: existing.subject || '',
      })
      if (existing.is_group) {
        const res = await fetch(`/api/admin/lesson-students?lesson_id=${existing.id}`, { headers })
        const ls = await res.json()
        setLessonStudents(ls)
        setGroupEntries(ls.map((s: LessonStudent) => ({ student_id: s.student_id, amount_due: String(s.amount_due || '') })))
      }
    } else {
      setForm({ tutor_id: '', student_id: '', duration_minutes: '60', amount_due: '', tutor_amount: '', is_group: false, repeat: false, repeat_weeks: '4', lesson_type: '', subject: '' })
      setGroupEntries([{ student_id: '', amount_due: '' }])
      setLessonStudents([])
    }
  }

  const calcEndTime = (start: string, minutes: number) => {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + minutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const createLesson = async (date: string) => {
    if (!modal) return
    const endTime = calcEndTime(modal.start_time, Number(form.duration_minutes))
    const body = {
      date,
      start_time: modal.start_time,
      end_time: endTime,
      duration_minutes: Number(form.duration_minutes),
      tutor_id: form.tutor_id || null,
      student_id: form.is_group ? null : (form.student_id || null),
      amount_due: form.is_group ? null : (form.amount_due ? Number(form.amount_due) : null),
      tutor_amount: form.tutor_amount ? Number(form.tutor_amount) : null,
      room: modal.room,
      is_group: form.is_group,
      status: form.tutor_id ? 'booked' : 'available',
      lesson_type: form.lesson_type || null,
      subject: form.subject || null,
    }
    const res = await fetch('/api/admin/lessons', { method: 'POST', headers, body: JSON.stringify(body) })
    const lesson = await res.json()

    if (form.is_group && lesson.id) {
      for (const entry of groupEntries.filter(e => e.student_id)) {
        await fetch('/api/admin/lesson-students', {
          method: 'POST',
          headers,
          body: JSON.stringify({ lesson_id: lesson.id, student_id: entry.student_id, amount_due: entry.amount_due ? Number(entry.amount_due) : null }),
        })
      }
    }
  }

  const handleSave = async () => {
    if (!modal) return
    setSaving(true)

    if (modal.lesson) {
      // Edit existing
      const endTime = calcEndTime(modal.start_time, Number(form.duration_minutes))
      await fetch('/api/admin/lessons', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: modal.lesson.id,
          tutor_id: form.tutor_id || null,
          student_id: form.is_group ? null : (form.student_id || null),
          amount_due: form.is_group ? null : (form.amount_due ? Number(form.amount_due) : null),
          duration_minutes: Number(form.duration_minutes),
          end_time: endTime,
          is_group: form.is_group,
        }),
      })
      // Update group students
      if (form.is_group) {
        for (const ls of lessonStudents) {
          await fetch(`/api/admin/lesson-students?id=${ls.id}`, { method: 'DELETE', headers })
        }
        for (const entry of groupEntries.filter(e => e.student_id)) {
          await fetch('/api/admin/lesson-students', {
            method: 'POST',
            headers,
            body: JSON.stringify({ lesson_id: modal.lesson.id, student_id: entry.student_id, amount_due: entry.amount_due ? Number(entry.amount_due) : null }),
          })
        }
      }
    } else if (form.repeat) {
      const weeks = Number(form.repeat_weeks)
      for (let i = 0; i < weeks; i++) {
        const d = new Date(modal.date)
        d.setDate(d.getDate() + i * 7)
        await createLesson(d.toISOString().split('T')[0])
      }
    } else {
      await createLesson(modal.date)
    }

    await loadLessons()
    setModal(null)
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!modal?.lesson) return
    await fetch(`/api/admin/lessons?id=${modal.lesson.id}`, { method: 'DELETE', headers })
    await loadLessons()
    setModal(null)
  }

  const prevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const nextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d) }

  const dayLabel = currentDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <button onClick={prevDay} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} className="text-gray-700" /></button>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 capitalize">{dayLabel}</p>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-blue-600 hover:underline">Dziś</button>
        </div>
        <button onClick={nextDay} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} className="text-gray-700" /></button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-20 px-3 py-3 text-left text-xs font-semibold text-gray-500">Godzina</th>
              {ROOMS.map(room => <th key={room} className="px-3 py-3 text-center text-xs font-semibold text-gray-700">{room}</th>)}
            </tr>
          </thead>
          <tbody>
            {HOURS.map(hour => (
              <tr key={hour} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-3 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{hour}</td>
                {ROOMS.map(room => {
                  const lesson = getLessonForSlot(hour, room)
                  return (
                    <td key={room} className="px-2 py-1.5 text-center">
                      {lesson ? (
                        <button onClick={() => openModal(hour, room)}
                          className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                            lesson.is_group ? 'bg-purple-100 hover:bg-purple-200 border border-purple-300' :
                            lesson.status === 'booked' || lesson.status === 'completed' ? 'bg-blue-100 hover:bg-blue-200 border border-blue-300' :
                            'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'
                          }`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            {lesson.is_group ? <Users size={10} className="text-purple-600" /> : <User size={10} className="text-blue-600" />}
                            <p className="font-semibold text-gray-900 truncate">{tutors.find(t => t.id === lesson.tutor_id)?.name || '—'}</p>
                          </div>
                          {!lesson.is_group && <p className="text-gray-600 truncate">{students.find(s => s.id === lesson.student_id)?.name || '—'}</p>}
                          {lesson.is_group && <p className="text-purple-700 text-xs">Grupa</p>}
                          {lesson.subject && <p className="text-gray-500 text-xs truncate">{lesson.subject}</p>}
                          {lesson.amount_due && <p className="text-green-700 font-medium">{lesson.amount_due} zł</p>}
                        </button>
                      ) : (
                        <button onClick={() => openModal(hour, room)}
                          className="w-full h-14 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center group">
                          <Plus size={16} className="text-gray-300 group-hover:text-blue-500" />
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 text-lg">
                {modal.room} · {modal.start_time} · {new Date(modal.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Type toggle */}
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, is_group: false })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition ${!form.is_group ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                  <User size={14} /> Indywidualne
                </button>
                <button onClick={() => setForm({ ...form, is_group: true })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition ${form.is_group ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-700 hover:border-purple-400'}`}>
                  <Users size={14} /> Grupowe
                </button>
              </div>

              {/* Tutor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Korepetytor</label>
                <select value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                  <option value="">— wybierz —</option>
                  {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Individual student */}
              {!form.is_group && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uczeń</label>
                    <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                      <option value="">— wybierz —</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kwota (zł)</label>
                    <input type="number" placeholder="np. 80" value={form.amount_due}
                      onChange={e => setForm({ ...form, amount_due: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              {/* Group students */}
              {form.is_group && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Uczniowie w grupie</label>
                  <div className="space-y-2">
                    {groupEntries.map((entry, i) => (
                      <div key={i} className="flex gap-2">
                        <select value={entry.student_id}
                          onChange={e => { const ne = [...groupEntries]; ne[i].student_id = e.target.value; setGroupEntries(ne) }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500">
                          <option value="">— uczeń —</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="number" placeholder="zł" value={entry.amount_due}
                          onChange={e => { const ne = [...groupEntries]; ne[i].amount_due = e.target.value; setGroupEntries(ne) }}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500" />
                        {groupEntries.length > 1 && (
                          <button onClick={() => setGroupEntries(groupEntries.filter((_, j) => j !== i))}
                            className="p-2 text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setGroupEntries([...groupEntries, { student_id: '', amount_due: '' }])}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-1">
                      <Plus size={14} /> Dodaj ucznia
                    </button>
                  </div>
                </div>
              )}

              {/* Tutor amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kwota dla korepetytora (zł)</label>
                <input type="number" placeholder="np. 50" value={form.tutor_amount}
                  onChange={e => setForm({ ...form, tutor_amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj zajęć</label>
                  <select value={form.lesson_type} onChange={e => setForm({ ...form, lesson_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">— wybierz —</option>
                    {LESSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Przedmiot</label>
                  <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    <option value="">— wybierz —</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Czas trwania</label>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setForm({ ...form, duration_minutes: String(d) })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        form.duration_minutes === String(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'
                      }`}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Repeat — only for new lessons */}
              {!modal.lesson && (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <RefreshCw size={14} /> Powtarzaj co tydzień
                    </span>
                  </label>
                  {form.repeat && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {REPEAT_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setForm({ ...form, repeat_weeks: String(opt.value) })}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                            form.repeat_weeks === String(opt.value) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
              {modal.lesson && (
                <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">Usuń</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Zapisywanie...' : form.repeat ? `Zapisz (${form.repeat_weeks === '52' ? 'do odwołania' : form.repeat_weeks + ' tyg.'})` : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
