'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, BookOpen, Pencil, Check, X, GraduationCap } from 'lucide-react'
import { Student, Lesson, StudentEnrollment } from '@/lib/types'
import RateInputs, { Rates, EMPTY_RATES, ratesToNumbers } from '@/app/components/RateInputs'

const SUBJECTS = ['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS']
const LOCATIONS = ['Wyszków', 'Online']
const DURATIONS = [30, 60, 90, 120]
const STATUSES = ['potencjalny', 'zapisany', 'aktywny', 'zawieszony', 'zakończył'] as const
const STATUS_COLORS: Record<string, string> = {
  potencjalny: 'bg-gray-100 text-gray-700',
  zapisany: 'bg-blue-100 text-blue-700',
  aktywny: 'bg-green-100 text-green-700',
  zawieszony: 'bg-orange-100 text-orange-700',
  'zakończył': 'bg-red-100 text-red-700',
}

export default function StudentsTab({ password, focusStudentId }: { password: string; focusStudentId?: string | null }) {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [history, setHistory] = useState<Lesson[]>([])
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([])
  const [form, setForm] = useState<{ name: string; email: string; phone: string; notes: string; status: string }>({ name: '', email: '', phone: '', notes: '', status: 'potencjalny' })
  const [rates, setRates] = useState<Rates>(EMPTY_RATES)
  const [editRates, setEditRates] = useState<Rates>(EMPTY_RATES)
  const [savingRates, setSavingRates] = useState(false)
  const [loading, setLoading] = useState(false)

  // Edycja danych ucznia
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({ name: '', email: '', phone: '', notes: '', birth_date: '', grade: '', location: 'Wyszków', status: 'potencjalny' })
  const [savingInfo, setSavingInfo] = useState(false)

  // Nowy zapis na przedmiot
  const [newEnrollment, setNewEnrollment] = useState({ subject: '', mode: 'individual' as 'individual' | 'group', location: 'Wyszków' as 'Wyszków' | 'Online', duration_minutes: 60, group_name: '', is_maturzysta: false, is_e8: false })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupValue, setEditingGroupValue] = useState('')
  const [savingEnrollment, setSavingEnrollment] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  useEffect(() => {
    fetch('/api/admin/students', { headers }).then(r => r.json()).then(setStudents)
  }, [])

  // Wybór ucznia z wyszukiwarki globalnej
  useEffect(() => {
    if (!focusStudentId || students.length === 0) return
    const s = students.find(x => x.id === focusStudentId)
    if (s) loadHistory(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStudentId, students])

  const loadHistory = async (student: Student) => {
    setSelectedStudent(student)
    setEditingInfo(false)
    setEditRates({
      rate_individual: student.rate_individual != null ? String(student.rate_individual) : '',
      rate_pair: student.rate_pair != null ? String(student.rate_pair) : '',
      rate_group: student.rate_group != null ? String(student.rate_group) : '',
    })
    setInfoForm({
      name: student.name, email: student.email || '', phone: student.phone || '', notes: student.notes || '',
      birth_date: student.birth_date || '', grade: student.grade || '',
      location: student.location || 'Wyszków', status: student.status || 'potencjalny',
    })
    const res = await fetch(`/api/admin/lessons?student_id=${student.id}`, { headers })
    const data = await res.json()
    setHistory(data)
    const enrRes = await fetch(`/api/admin/enrollments?student_id=${student.id}`, { headers })
    setEnrollments(enrRes.ok ? await enrRes.json() : [])
  }

  const saveInfo = async () => {
    if (!selectedStudent) return
    setSavingInfo(true)
    const res = await fetch('/api/admin/students', {
      method: 'PUT', headers,
      body: JSON.stringify({ id: selectedStudent.id, ...infoForm, birth_date: infoForm.birth_date || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setStudents(students.map(s => s.id === updated.id ? updated : s))
      setSelectedStudent(updated)
      setEditingInfo(false)
    }
    setSavingInfo(false)
  }

  const saveRates = async () => {
    if (!selectedStudent) return
    setSavingRates(true)
    const res = await fetch('/api/admin/students', {
      method: 'PUT', headers,
      body: JSON.stringify({ id: selectedStudent.id, ...ratesToNumbers(editRates) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setStudents(students.map(s => s.id === updated.id ? updated : s))
      setSelectedStudent(updated)
    }
    setSavingRates(false)
  }

  const addEnrollment = async () => {
    if (!selectedStudent || !newEnrollment.subject) return
    setSavingEnrollment(true)
    const res = await fetch('/api/admin/enrollments', {
      method: 'POST', headers,
      body: JSON.stringify({ student_id: selectedStudent.id, ...newEnrollment }),
    })
    if (res.ok) {
      const created = await res.json()
      setEnrollments([created, ...enrollments])
      setNewEnrollment({ subject: '', mode: 'individual', location: 'Wyszków', duration_minutes: 60, group_name: '', is_maturzysta: false, is_e8: false })
    }
    setSavingEnrollment(false)
  }

  const toggleEnrollmentActive = async (enrollment: StudentEnrollment) => {
    const res = await fetch('/api/admin/enrollments', {
      method: 'PUT', headers,
      body: JSON.stringify({ id: enrollment.id, active: !enrollment.active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEnrollments(enrollments.map(e => e.id === updated.id ? updated : e))
    }
  }

  const deleteEnrollment = async (id: string) => {
    if (!confirm('Usunąć ten zapis?')) return
    const res = await fetch(`/api/admin/enrollments?id=${id}`, { method: 'DELETE', headers })
    if (res.ok) setEnrollments(enrollments.filter(e => e.id !== id))
  }

  const saveEnrollmentGroup = async (id: string, group_name: string) => {
    const res = await fetch('/api/admin/enrollments', {
      method: 'PUT', headers,
      body: JSON.stringify({ id, group_name: group_name.trim() || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setEnrollments(enrollments.map(e => e.id === updated.id ? updated : e))
    }
    setEditingGroupId(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...form, ...ratesToNumbers(rates) }),
    })
    if (res.ok) {
      const s = await res.json()
      setStudents([s, ...students])
      setForm({ name: '', email: '', phone: '', notes: '', status: 'potencjalny' })
      setRates(EMPTY_RATES)
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
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">Status ucznia</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 w-full md:w-48">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="md:col-span-4">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Sugerowane stawki ucznia (kwota do zapłaty)</p>
            <RateInputs value={rates} onChange={setRates} />
          </div>
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

        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">
              {selectedStudent ? selectedStudent.name : 'Wybierz ucznia'}
            </span>
            {selectedStudent && !editingInfo && (
              <button onClick={() => setEditingInfo(true)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                <Pencil size={14} />
              </button>
            )}
          </div>

          {!selectedStudent ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Kliknij na ucznia</p>
          ) : (
            <>
              {/* Dane ucznia — edycja */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                {editingInfo ? (
                  <div className="space-y-2">
                    <input value={infoForm.name} onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
                      placeholder="Imię i nazwisko"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    <input value={infoForm.phone} onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })}
                      placeholder="Telefon ucznia"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    <input value={infoForm.email} onChange={e => setInfoForm({ ...infoForm, email: e.target.value })}
                      placeholder="Email ucznia"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Data urodzenia</label>
                        <input type="date" value={infoForm.birth_date} onChange={e => setInfoForm({ ...infoForm, birth_date: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Klasa</label>
                        <input value={infoForm.grade} onChange={e => setInfoForm({ ...infoForm, grade: e.target.value })}
                          placeholder="np. 8, 3 LO"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Miejscowość / tryb</label>
                        <select value={infoForm.location} onChange={e => setInfoForm({ ...infoForm, location: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Status</label>
                        <select value={infoForm.status} onChange={e => setInfoForm({ ...infoForm, status: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea value={infoForm.notes} onChange={e => setInfoForm({ ...infoForm, notes: e.target.value })}
                      placeholder="Notatki"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" rows={2} />
                    <div className="flex gap-2">
                      <button onClick={saveInfo} disabled={savingInfo}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                        <Check size={14} /> {savingInfo ? 'Zapisywanie...' : 'Zapisz'}
                      </button>
                      <button onClick={() => setEditingInfo(false)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300">
                        <X size={14} /> Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 space-y-0.5">
                    <div className="mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedStudent.status] || 'bg-gray-100 text-gray-700'}`}>
                        {selectedStudent.status || 'potencjalny'}
                      </span>
                    </div>
                    <p>📞 {selectedStudent.phone || '—'}</p>
                    <p>📧 {selectedStudent.email || '—'}</p>
                    <p>🎂 {selectedStudent.birth_date ? new Date(selectedStudent.birth_date).toLocaleDateString('pl-PL') : '—'}</p>
                    <p>🎓 Klasa: {selectedStudent.grade || '—'}</p>
                    <p>📍 {selectedStudent.location || '—'}</p>
                    {selectedStudent.notes && <p className="text-gray-500 italic">📝 {selectedStudent.notes}</p>}
                  </div>
                )}
              </div>

              {/* Stawki */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Sugerowane stawki</p>
                <RateInputs value={editRates} onChange={setEditRates} compact />
                <button onClick={saveRates} disabled={savingRates}
                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {savingRates ? 'Zapisywanie...' : 'Zapisz stawki'}
                </button>
              </div>

              {/* Zapisy na przedmioty */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><GraduationCap size={14} /> Zapisy na przedmioty</p>

                {enrollments.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {enrollments.map(en => (
                      <div key={en.id} className={`px-3 py-2 rounded-lg text-sm ${en.active ? 'bg-blue-50' : 'bg-gray-100 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{en.subject}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {en.mode === 'individual' ? 'indywidualne' : 'grupowe'} · {en.location} · {en.duration_minutes} min
                            {en.mode === 'group' && editingGroupId !== en.id && (en.group_name
                              ? ` · grupa: ${en.group_name}`
                              : ' · ⏳ oczekuje na przydział do grupy')}
                            {en.is_maturzysta && ' · maturzysta'}
                            {en.is_e8 && ' · E8'}
                          </span>
                          {!en.active && en.cancelled_at && (
                            <span className="text-xs text-red-500 ml-2">
                              (rezygnacja: {new Date(en.cancelled_at).toLocaleDateString('pl-PL')})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {en.mode === 'group' && editingGroupId !== en.id && (
                            <button onClick={() => { setEditingGroupId(en.id); setEditingGroupValue(en.group_name || '') }}
                              className="text-xs px-2 py-1 rounded-lg font-medium text-blue-600 hover:bg-blue-100">
                              {en.group_name ? 'Zmień grupę' : 'Przydziel grupę'}
                            </button>
                          )}
                          <button onClick={() => toggleEnrollmentActive(en)}
                            className={`text-xs px-2 py-1 rounded-lg font-medium ${en.active ? 'text-orange-600 hover:bg-orange-100' : 'text-green-600 hover:bg-green-100'}`}>
                            {en.active ? 'Rezygnacja' : 'Przywróć'}
                          </button>
                          <button onClick={() => deleteEnrollment(en.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        </div>
                        {editingGroupId === en.id && (
                          <div className="flex items-center gap-2 mt-2">
                            <input autoFocus value={editingGroupValue} onChange={e => setEditingGroupValue(e.target.value)}
                              placeholder="Nazwa grupy (np. Matura MAT A)"
                              onKeyDown={e => { if (e.key === 'Enter') saveEnrollmentGroup(en.id, editingGroupValue); if (e.key === 'Escape') setEditingGroupId(null) }}
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900" />
                            <button onClick={() => saveEnrollmentGroup(en.id, editingGroupValue)}
                              className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Zapisz</button>
                            <button onClick={() => setEditingGroupId(null)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300">Anuluj</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={newEnrollment.subject} onChange={e => setNewEnrollment({ ...newEnrollment, subject: e.target.value })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                    <option value="">Przedmiot...</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={newEnrollment.mode} onChange={e => setNewEnrollment({ ...newEnrollment, mode: e.target.value as 'individual' | 'group' })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                    <option value="individual">Indywidualne</option>
                    <option value="group">Grupowe</option>
                  </select>
                  <select value={newEnrollment.location} onChange={e => setNewEnrollment({ ...newEnrollment, location: e.target.value as 'Wyszków' | 'Online' })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <select value={newEnrollment.duration_minutes} onChange={e => setNewEnrollment({ ...newEnrollment, duration_minutes: Number(e.target.value) })}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                    {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                  {newEnrollment.mode === 'group' && (
                    <input value={newEnrollment.group_name} onChange={e => setNewEnrollment({ ...newEnrollment, group_name: e.target.value })}
                      placeholder="Nazwa grupy (opcjonalnie — możesz przydzielić później)"
                      className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400" />
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-600 col-span-2">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={newEnrollment.is_maturzysta}
                        onChange={e => setNewEnrollment({ ...newEnrollment, is_maturzysta: e.target.checked })} />
                      Maturzysta
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={newEnrollment.is_e8}
                        onChange={e => setNewEnrollment({ ...newEnrollment, is_e8: e.target.checked })} />
                      E8
                    </label>
                  </div>
                </div>
                {newEnrollment.mode === 'group' && !newEnrollment.group_name && (
                  <p className="text-xs text-gray-500 mb-2">💡 Możesz zapisać bez nazwy grupy — uczeń trafi na listę oczekujących na dany kurs. Przydzielisz go do konkretnej grupy (z terminem), gdy będzie znany harmonogram — wtedy dopiero wpłynie na wypełnienie lokalu.</p>
                )}
                <button onClick={addEnrollment} disabled={savingEnrollment || !newEnrollment.subject}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {savingEnrollment ? 'Zapisywanie...' : '+ Dodaj zapis'}
                </button>
              </div>

              {/* Historia zajęć */}
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Historia zajęć</span>
              </div>
              {history.length === 0 ? (
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
