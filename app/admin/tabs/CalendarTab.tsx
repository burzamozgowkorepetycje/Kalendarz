'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, RefreshCw, Users, User, Trash2, CalendarDays, Calendar, Search, Video, MapPin, Send } from 'lucide-react'
import { Tutor, Student, Lesson, LessonStudent, CourseGroup, StudentEnrollment } from '@/lib/types'
import Combobox from '@/app/components/Combobox'
import { defaultStudentPrice } from '@/lib/pricing'

const ROOMS = ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6']
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const DURATIONS = [30, 60, 90, 120]
const REPEAT_OPTIONS = [{ label: '2 tyg.', value: 2 }, { label: '4 tyg.', value: 4 }, { label: '8 tyg.', value: 8 }, { label: '12 tyg.', value: 12 }, { label: 'Do odwołania', value: 52 }]
const LESSON_TYPES = ['Kursy maturalne', 'Zajęcia indywidualne', 'Zajęcia grupowe']
const SUBJECTS = ['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS']
const DAY_NAMES = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

interface SlotModal { date: string; room: string; start_time: string; lesson?: Lesson }
interface GroupEntry { student_id: string; amount_due: string }

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }

export default function CalendarTab({ password }: { password: string }) {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [location, setLocation] = useState<'Wyszków' | 'Online'>('Wyszków')
  const [sendingMeet, setSendingMeet] = useState<string | null>(null)
  const [availAll, setAvailAll] = useState<{ tutor_id: string; weekday: number; start_time: string; end_time: string }[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [modal, setModal] = useState<SlotModal | null>(null)
  const [lessonStudents, setLessonStudents] = useState<LessonStudent[]>([])
  const [form, setForm] = useState({
    tutor_id: '', student_id: '', duration_minutes: '60',
    amount_due: '', tutor_amount: '', is_group: false,
    repeat: false, repeat_weeks: '4', lesson_type: '', subject: '',
    count_earnings: true,
  })
  const [groupEntries, setGroupEntries] = useState<GroupEntry[]>([{ student_id: '', amount_due: '' }])
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteScope, setDeleteScope] = useState<'this' | 'future' | 'all'>('this')
  const [findOpen, setFindOpen] = useState(false)
  const [findForm, setFindForm] = useState({ student_id: '', subject: '', tutor_id: 'any', duration: 60, weekdays: [] as number[], from_hour: '15:00', to_hour: '20:00' })
  const [proposals, setProposals] = useState<{ date: string; start_time: string; end_time: string; room: string; tutor_id: string; tutor_name: string }[]>([])
  const [finding, setFinding] = useState(false)
  const [findSearched, setFindSearched] = useState(false)
  const [conflictModal, setConflictModal] = useState<{ kind: 'conflict' | 'warning'; messages: string[] } | null>(null)
  const [ownerPwd, setOwnerPwd] = useState('')
  const [ownerPwdError, setOwnerPwdError] = useState(false)
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([])
  const [allEnrollments, setAllEnrollments] = useState<StudentEnrollment[]>([])
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }
  const dateStr = toDateStr(currentDate)
  const weekStart = getMonday(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekFrom = toDateStr(weekDays[0])
  const weekTo = toDateStr(weekDays[6])

  useEffect(() => {
    fetch('/api/admin/tutors', { headers }).then(r => r.json()).then(setTutors)
    fetch('/api/admin/students', { headers }).then(r => r.json()).then(setStudents)
    fetch('/api/admin/tutor-availability', { headers }).then(r => r.json()).then(d => setAvailAll(Array.isArray(d) ? d : []))
    fetch('/api/admin/course-groups', { headers }).then(r => r.ok ? r.json() : []).then(d => setCourseGroups(Array.isArray(d) ? d.filter(g => g.active) : []))
    fetch('/api/admin/enrollments', { headers }).then(r => r.ok ? r.json() : []).then(d => setAllEnrollments(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { loadLessons() }, [dateStr, view, location])

  const loadLessons = async () => {
    const online = location === 'Online'
    const from = (view === 'week' && !online) ? weekFrom : dateStr
    const to = (view === 'week' && !online) ? weekTo : dateStr
    const res = await fetch(`/api/admin/lessons?from=${from}&to=${to}&location=${encodeURIComponent(location)}`, { headers })
    const data = await res.json()
    setLessons(Array.isArray(data) ? data : [])
  }

  // dopasowanie po "kubełku godzinowym" — lekcja 12:30 trafia do wiersza 12:00
  const sameHourBucket = (start: string | null | undefined, hour: string) =>
    String(start ?? '').substring(0, 2) === hour.substring(0, 2)

  const getLessonForSlot = (hour: string, room: string, date?: string) =>
    lessons.find(l =>
      sameHourBucket(l.start_time, hour) &&
      l.room === room &&
      (date ? l.date === date : l.date === dateStr)
    )

  const getLessonsForDayHour = (date: string, hour: string) =>
    lessons.filter(l => l.date === date && sameHourBucket(l.start_time, hour))

  const loadModalForm = async (existing?: Lesson) => {
    setSelectedCourseGroupId('')
    if (existing) {
      setForm({
        tutor_id: existing.tutor_id || '',
        student_id: existing.student_id || '',
        duration_minutes: String(existing.duration_minutes),
        amount_due: String(existing.amount_due || ''),
        tutor_amount: String(existing.tutor_amount || ''),
        is_group: existing.is_group,
        repeat: false, repeat_weeks: '4',
        lesson_type: existing.lesson_type || '',
        subject: existing.subject || '',
        count_earnings: existing.count_toward_earnings ?? true,
      })
      if (existing.is_group) {
        const res = await fetch(`/api/admin/lesson-students?lesson_id=${existing.id}`, { headers })
        const ls = await res.json()
        setLessonStudents(ls)
        setGroupEntries(ls.map((s: LessonStudent) => ({ student_id: s.student_id, amount_due: String(s.amount_due || '') })))
      } else {
        setGroupEntries([{ student_id: '', amount_due: '' }])
        setLessonStudents([])
      }
    } else {
      setForm({ tutor_id: '', student_id: '', duration_minutes: '60', amount_due: '', tutor_amount: '', is_group: false, repeat: false, repeat_weeks: '4', lesson_type: '', subject: '', count_earnings: true })
      setGroupEntries([{ student_id: '', amount_due: '' }])
      setLessonStudents([])
    }
  }

  const openModal = async (hour: string, room: string, date?: string) => {
    const modalDate = date || dateStr
    const existing = getLessonForSlot(hour, room, modalDate)
    const startTime = existing ? String(existing.start_time).substring(0, 5) : hour
    setModal({ date: modalDate, room, start_time: startTime, lesson: existing })
    await loadModalForm(existing)
  }

  const openOnlineModal = async (existing?: Lesson, prefill?: { tutor_id?: string; start_time?: string }) => {
    setModal({ date: dateStr, room: 'Online', start_time: existing ? String(existing.start_time).substring(0, 5) : (prefill?.start_time || '15:00'), lesson: existing })
    await loadModalForm(existing)
    if (!existing && prefill?.tutor_id) {
      const t = tutors.find(x => x.id === prefill.tutor_id)
      setForm(f => ({ ...f, tutor_id: prefill.tutor_id!, tutor_amount: f.tutor_amount || rateFor(t, 'individual') }))
    }
  }

  // dostępność korepetytora online w danej godzinie (dla siatki online)
  // w siatce online pokazujemy tylko korepetytorów z zajęciami online tego dnia
  const onlineLessonTutorIds = new Set(lessons.map(l => l.tutor_id))
  const onlineTutors = tutors.filter(t => onlineLessonTutorIds.has(t.id))
  const tutorAvailableAt = (tutorId: string, hour: string) => {
    const rows = availAll.filter(a => a.tutor_id === tutorId)
    if (rows.length === 0) return true
    const wd = (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7
    const hMin = parseInt(hour.substring(0, 2)) * 60
    return rows.some(r => r.weekday === wd && parseInt(String(r.start_time).substring(0, 2)) * 60 <= hMin && parseInt(String(r.end_time).substring(0, 2)) * 60 > hMin)
  }
  const onlineLessonAt = (tutorId: string, hour: string) =>
    lessons.find(l => l.tutor_id === tutorId && String(l.start_time).substring(0, 2) === hour.substring(0, 2))

  const calcEndTime = (start: string, minutes: number) => {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + minutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  // Sugerowana stawka wg typu zajęć (indywidualne / para / grupa)
  const rateFor = (obj: { rate_individual: number | null; rate_pair: number | null; rate_group: number | null } | undefined,
                   type: 'individual' | 'pair' | 'group'): string => {
    if (!obj) return ''
    const v = type === 'individual' ? obj.rate_individual : type === 'pair' ? obj.rate_pair : obj.rate_group
    return v != null ? String(v) : ''
  }
  const groupCount = () => groupEntries.filter(e => e.student_id).length

  const studentIds = () =>
    form.is_group
      ? groupEntries.filter(e => e.student_id).map(e => e.student_id)
      : (form.student_id ? [form.student_id] : [])

  const createLesson = async (date: string, series_id?: string | null, force?: boolean, owner_password?: string, ack_warnings?: boolean) => {
    if (!modal) return
    const endTime = calcEndTime(modal.start_time, Number(form.duration_minutes))
    const body = {
      date, start_time: modal.start_time, end_time: endTime,
      duration_minutes: Number(form.duration_minutes),
      tutor_id: form.tutor_id || null,
      student_id: form.is_group ? null : (form.student_id || null),
      student_ids: studentIds(),
      amount_due: form.is_group ? null : (form.amount_due ? Number(form.amount_due) : null),
      tutor_amount: form.tutor_amount ? Number(form.tutor_amount) : null,
      room: modal.room, location, is_group: form.is_group,
      status: form.tutor_id ? 'booked' : 'available',
      lesson_type: form.lesson_type || null,
      subject: form.subject || null,
      series_id: series_id || null,
      count_toward_earnings: form.count_earnings,
      force: force || false,
      owner_password: owner_password || undefined,
      ack_warnings: ack_warnings || false,
    }
    const res = await fetch('/api/admin/lessons', { method: 'POST', headers, body: JSON.stringify(body) })
    const lesson = await res.json()
    if (!res.ok) return { ok: false as const, error: lesson.error as string, conflicts: lesson.conflicts as string[] | undefined, warnings: lesson.warnings as string[] | undefined, status: res.status }
    if (form.is_group && lesson.id) {
      for (const entry of groupEntries.filter(e => e.student_id)) {
        await fetch('/api/admin/lesson-students', {
          method: 'POST', headers,
          body: JSON.stringify({ lesson_id: lesson.id, student_id: entry.student_id, amount_due: entry.amount_due ? Number(entry.amount_due) : null }),
        })
      }
    }
    return { ok: true as const }
  }

  const handleSave = async (force?: boolean, owner_password?: string, ack_warnings?: boolean) => {
    if (!modal) return
    setSaving(true)
    if (modal.lesson) {
      const endTime = calcEndTime(modal.start_time, Number(form.duration_minutes))
      const res = await fetch('/api/admin/lessons', {
        method: 'PUT', headers,
        body: JSON.stringify({
          id: modal.lesson.id,
          date: modal.date,
          room: location === 'Online' ? null : modal.room,
          location,
          start_time: modal.start_time,
          tutor_id: form.tutor_id || null,
          student_id: form.is_group ? null : (form.student_id || null),
          student_ids: studentIds(),
          amount_due: form.is_group ? null : (form.amount_due ? Number(form.amount_due) : null),
          tutor_amount: form.tutor_amount ? Number(form.tutor_amount) : null,
          duration_minutes: Number(form.duration_minutes),
          end_time: endTime, is_group: form.is_group,
          lesson_type: form.lesson_type || null,
          subject: form.subject || null,
          count_toward_earnings: form.count_earnings,
          force: force || false,
          owner_password: owner_password || undefined,
          ack_warnings: ack_warnings || false,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSaving(false)
        if (res.status === 403) { setOwnerPwdError(true); return } // złe hasło właściciela — modal kolizji zostaje
        if (res.status === 409 && data.conflicts) {
          setConflictModal({ kind: 'conflict', messages: data.conflicts })
          return
        }
        if (res.status === 409 && data.warnings) {
          setConflictModal({ kind: 'warning', messages: data.warnings })
          return
        }
        alert(data.error || 'Nie udało się zapisać zmian')
        return
      }
      if (form.is_group) {
        for (const ls of lessonStudents) {
          await fetch(`/api/admin/lesson-students?id=${ls.id}`, { method: 'DELETE', headers })
        }
        for (const entry of groupEntries.filter(e => e.student_id)) {
          await fetch('/api/admin/lesson-students', {
            method: 'POST', headers,
            body: JSON.stringify({ lesson_id: modal.lesson.id, student_id: entry.student_id, amount_due: entry.amount_due ? Number(entry.amount_due) : null }),
          })
        }
      }
    } else if (form.repeat) {
      const weeks = Number(form.repeat_weeks)
      const seriesId = crypto.randomUUID()
      const skipped: string[] = []
      for (let i = 0; i < weeks; i++) {
        const d = new Date(modal.date)
        d.setDate(d.getDate() + i * 7)
        const ds = toDateStr(d)
        // przy serii akceptujemy ostrzeżenia o dostępności (i tak pokażą się per termin zbiorczo)
        const r = await createLesson(ds, seriesId, force, owner_password, true)
        if (r && !r.ok) skipped.push(ds)
      }
      if (skipped.length > 0) {
        await loadLessons()
        alert(`Część terminów pominięto (kolizja): ${skipped.join(', ')}. Pozostałe zostały dodane.`)
        setSaving(false)
        return
      }
    } else {
      const r = await createLesson(modal.date, null, force, owner_password, ack_warnings)
      if (r && !r.ok) {
        setSaving(false)
        if (r.status === 403) { setOwnerPwdError(true); return } // złe hasło właściciela
        if (r.conflicts) {
          setConflictModal({ kind: 'conflict', messages: r.conflicts })
          return
        }
        if (r.warnings) {
          setConflictModal({ kind: 'warning', messages: r.warnings })
          return
        }
        alert(r.error || 'Nie udało się dodać zajęć')
        return
      }
    }
    await loadLessons()
    setModal(null)
    setConflictModal(null)
    setOwnerPwd('')
    setOwnerPwdError(false)
    setSaving(false)
  }

  const handleDelete = async (credit: boolean) => {
    if (!modal?.lesson) return
    const scope = modal.lesson.series_id ? deleteScope : 'this'
    await fetch(`/api/admin/lessons?id=${modal.lesson.id}&credit=${credit}&scope=${scope}`, { method: 'DELETE', headers })
    await loadLessons()
    setDeleteConfirm(false)
    setDeleteScope('this')
    setModal(null)
  }

  const runFind = async () => {
    setFinding(true)
    setFindSearched(true)
    const res = await fetch('/api/admin/find-slots', { method: 'POST', headers, body: JSON.stringify({ ...findForm, mode: location === 'Online' ? 'online' : 'onsite' }) })
    const data = await res.json()
    setProposals(res.ok ? (data.proposals || []) : [])
    setFinding(false)
  }

  const openFromProposal = (p: { date: string; start_time: string; room: string; tutor_id: string }) => {
    setCurrentDate(new Date(p.date + 'T00:00:00'))
    setFindOpen(false)
    if (location === 'Online') { openOnlineModal(undefined, { tutor_id: p.tutor_id, start_time: p.start_time }); return }
    setModal({ date: p.date, room: p.room, start_time: p.start_time, lesson: undefined })
    const tutor = tutors.find(t => t.id === p.tutor_id)
    const student = students.find(s => s.id === findForm.student_id)
    setForm({
      tutor_id: p.tutor_id,
      student_id: findForm.student_id || '',
      duration_minutes: String(findForm.duration),
      amount_due: rateFor(student, 'individual'),
      tutor_amount: rateFor(tutor, 'individual'),
      is_group: false, repeat: false, repeat_weeks: '4',
      lesson_type: '', subject: findForm.subject || '',
      count_earnings: true,
    })
    setGroupEntries([{ student_id: '', amount_due: '' }])
    setFindOpen(false)
  }

  const sendMeet = async (lessonId: string) => {
    setSendingMeet(lessonId)
    const res = await fetch('/api/admin/send-meet', { method: 'POST', headers, body: JSON.stringify({ lesson_id: lessonId }) })
    const data = await res.json().catch(() => ({}))
    setSendingMeet(null)
    alert(res.ok ? `Link Meet wysłany emailem (${data.sent})` : `Nie wysłano: ${data.error || 'błąd'}`)
  }

  const prevDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d) }
  const nextDay = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d) }
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }

  const dayLabel = currentDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const weekLabel = `${weekDays[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const todayStr = toDateStr(new Date())

  const lessonColor = (lesson: Lesson) =>
    lesson.is_group ? 'bg-purple-100 border-purple-300 text-purple-900' :
    lesson.status === 'booked' || lesson.status === 'completed' ? 'bg-blue-100 border-blue-300 text-blue-900' :
    'bg-yellow-50 border-yellow-200 text-yellow-900'

  return (
    <div className="space-y-4">
      {/* Location selector */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit">
        {(['Wyszków', 'Online'] as const).map(loc => (
          <button key={loc} onClick={() => { setLocation(loc); if (loc === 'Online') setView('day') }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition ${location === loc ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {loc === 'Online' ? <Video size={15} /> : <MapPin size={15} />} {loc}
          </button>
        ))}
      </div>

      {/* Nav bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        {/* View toggle — tylko stacjonarnie */}
        {location !== 'Online' && (
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 self-center sm:self-auto">
          <button onClick={() => setView('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Calendar size={15} /> Dzień
          </button>
          <button onClick={() => setView('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <CalendarDays size={15} /> Tydzień
          </button>
        </div>
        )}

        {/* Date navigation */}
        <div className="flex items-center gap-2 flex-1 justify-between sm:justify-center">
          <button onClick={view === 'day' ? prevDay : prevWeek} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <div className="text-center sm:min-w-[200px]">
            <p className="font-bold text-gray-900 capitalize text-sm">{view === 'day' ? dayLabel : weekLabel}</p>
            <button onClick={() => setCurrentDate(new Date())} className="text-xs text-blue-600 hover:underline">Dziś</button>
          </div>
          <button onClick={view === 'day' ? nextDay : nextWeek} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} className="text-gray-700" />
          </button>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { setFindOpen(true); setProposals([]); setFindSearched(false) }}
            className="flex items-center gap-1.5 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50">
            <Search size={15} /> Znajdź termin
          </button>
          {location === 'Online' && (
            <button onClick={() => openOnlineModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              <Plus size={15} /> Dodaj
            </button>
          )}
        </div>
      </div>

      {/* ONLINE VIEW — siatka: korepetytorzy online jako kolumny */}
      {location === 'Online' && (
        onlineTutors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center text-gray-400 text-sm">
            Brak zajęć online tego dnia. Kliknij „Dodaj" lub „Znajdź termin", aby umówić zajęcia online z wybranym korepetytorem.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: `${80 + onlineTutors.length * 130}px` }}>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-16 px-3 py-3 text-left text-xs font-semibold text-gray-500">Godz.</th>
                  {onlineTutors.map(t => (
                    <th key={t.id} className="px-2 py-3 text-center text-xs font-semibold text-gray-700">
                      <div className="flex items-center justify-center gap-1"><Video size={11} className="text-blue-500" /> {t.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap">{hour}</td>
                    {onlineTutors.map(t => {
                      const lesson = onlineLessonAt(t.id, hour)
                      const avail = tutorAvailableAt(t.id, hour)
                      return (
                        <td key={t.id} className={`px-1 py-1 ${!lesson && !avail ? 'bg-gray-50' : ''}`}>
                          {lesson ? (
                            <div className={`rounded-lg px-2 py-1.5 text-xs border ${lesson.is_group ? 'bg-purple-100 border-purple-300' : 'bg-blue-100 border-blue-300'}`}>
                              <button onClick={() => openOnlineModal(lesson)} className="text-left w-full">
                                <p className="font-semibold text-gray-900 truncate">
                                  {lesson.is_group ? 'Grupa' : (students.find(s => s.id === lesson.student_id)?.name || '—')}
                                </p>
                                <p className="text-gray-600">{String(lesson.start_time).substring(0, 5)} · {lesson.duration_minutes}m</p>
                              </button>
                              <button onClick={() => sendMeet(lesson.id)} disabled={sendingMeet === lesson.id}
                                className="mt-1 w-full flex items-center justify-center gap-1 bg-white/70 rounded text-[11px] text-blue-700 py-0.5 hover:bg-white">
                                <Send size={10} /> {sendingMeet === lesson.id ? '...' : 'Wyślij link'}
                              </button>
                            </div>
                          ) : avail ? (
                            <button onClick={() => openOnlineModal(undefined, { tutor_id: t.id, start_time: hour })}
                              className="w-full h-12 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center group">
                              <Plus size={14} className="text-gray-300 group-hover:text-blue-500" />
                            </button>
                          ) : (
                            <div className="w-full h-12 rounded-lg flex items-center justify-center text-[10px] text-gray-300">niedost.</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* DAY VIEW */}
      {location !== 'Online' && view === 'day' && (
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
                      <td key={room} className="px-2 py-1.5">
                        {lesson ? (
                          <button onClick={() => openModal(hour, room)}
                            className={`w-full rounded-lg px-2 py-2 text-left text-xs border transition hover:opacity-80 ${lessonColor(lesson)}`}>
                            <div className="flex items-center gap-1 mb-0.5">
                              {lesson.is_group ? <Users size={10} /> : <User size={10} />}
                              <p className="font-semibold truncate">{tutors.find(t => t.id === lesson.tutor_id)?.name || '—'}</p>
                              {lesson.series_id && <RefreshCw size={9} className="shrink-0 opacity-60" />}
                            </div>
                            <p className="opacity-70">{String(lesson.start_time).substring(0,5)}–{String(lesson.end_time).substring(0,5)}</p>
                            {!lesson.is_group && <p className="truncate opacity-80">{students.find(s => s.id === lesson.student_id)?.name || '—'}</p>}
                            {lesson.is_group && <p className="opacity-80">Grupa</p>}
                            {lesson.subject && <p className="opacity-60 truncate">{lesson.subject}</p>}
                            {lesson.amount_due && <p className="font-medium">{lesson.amount_due} zł</p>}
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
      )}

      {/* WEEK VIEW */}
      {location !== 'Online' && view === 'week' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-16 px-3 py-3 text-left text-xs font-semibold text-gray-500">Godz.</th>
                {weekDays.map((day, i) => {
                  const ds = toDateStr(day)
                  const isToday = ds === todayStr
                  return (
                    <th key={ds} className="px-2 py-3 text-center">
                      <p className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{DAY_NAMES[i]}</p>
                      <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {day.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })}
                      </p>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour} className="border-b border-gray-100">
                  <td className="px-3 py-1 text-xs font-medium text-gray-500 whitespace-nowrap align-top pt-2">{hour}</td>
                  {weekDays.map(day => {
                    const ds = toDateStr(day)
                    const dayLessons = getLessonsForDayHour(ds, hour)
                    const isToday = ds === todayStr
                    return (
                      <td key={ds} className={`px-1 py-1 align-top min-w-[100px] ${isToday ? 'bg-blue-50/30' : ''}`}>
                        {dayLessons.length > 0 ? (
                          <div className="space-y-1">
                            {dayLessons.map(lesson => (
                              <button key={lesson.id}
                                onClick={() => openModal(hour, lesson.room!, ds)}
                                className={`w-full rounded-md px-1.5 py-1 text-left text-xs border transition hover:opacity-80 ${lessonColor(lesson)}`}>
                                <p className="font-semibold truncate">{lesson.room} · {String(lesson.start_time).substring(0,5)}</p>
                                <p className="truncate opacity-80">{tutors.find(t => t.id === lesson.tutor_id)?.name || '—'}</p>
                                {!lesson.is_group && <p className="truncate opacity-60">{students.find(s => s.id === lesson.student_id)?.name || '—'}</p>}
                                {lesson.subject && <p className="opacity-50 truncate">{lesson.subject}</p>}
                              </button>
                            ))}
                            <button onClick={() => openModal(hour, ROOMS[0], ds)}
                              className="w-full h-6 rounded-md border border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center">
                              <Plus size={12} className="text-gray-300" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => openModal(hour, ROOMS[0], ds)}
                            className="w-full h-12 rounded-md border-2 border-dashed border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition flex items-center justify-center group">
                            <Plus size={14} className="text-gray-200 group-hover:text-blue-400" />
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
      )}

      {/* Potwierdzenie usuwania z opcją kredytu */}
      {modal?.lesson && deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Usunąć zajęcia?</h3>

            {/* Wybór zakresu — tylko gdy lekcja należy do cyklu */}
            {modal.lesson?.series_id && (
              <div className="mb-4 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Zakres (zajęcia cykliczne)</p>
                {([
                  { val: 'this', label: 'Tylko te zajęcia' },
                  { val: 'future', label: 'Te i wszystkie przyszłe z cyklu' },
                  { val: 'all', label: 'Cały cykl (też przeszłe)' },
                ] as const).map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="radio" name="deleteScope" checked={deleteScope === opt.val}
                      onChange={() => setDeleteScope(opt.val)}
                      className="w-4 h-4 text-red-600" />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            <p className="text-sm text-gray-600 mb-5">
              Jeśli uczeń zapłacił już za {deleteScope === 'this' ? 'tę lekcję' : 'te lekcje'}, możesz odliczyć kwotę
              od następnego rachunku (nadpłata zostanie zapisana jako kredyt ucznia).
            </p>
            <div className="space-y-2">
              <button onClick={() => handleDelete(true)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700">
                Usuń i odlicz uczniowi (kredyt)
              </button>
              <button onClick={() => handleDelete(false)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700">
                Usuń bez odliczania
              </button>
              <button onClick={() => setDeleteConfirm(false)}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50">
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Znajdź wolny termin */}
      {findOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[65] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Search size={18} /> Znajdź wolny termin</h3>
              <button onClick={() => setFindOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Uczeń</label>
                <Combobox value={findForm.student_id}
                  options={students.map(s => ({ id: s.id, label: s.name, sublabel: s.phone || '' }))}
                  onChange={id => setFindForm({ ...findForm, student_id: id })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Przedmiot</label>
                  <select value={findForm.subject} onChange={e => setFindForm({ ...findForm, subject: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                    <option value="">— dowolny —</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Korepetytor</label>
                  <Combobox value={findForm.tutor_id}
                    options={[{ id: 'any', label: 'Dowolny korepetytor' }, ...tutors.map(t => ({ id: t.id, label: t.name, sublabel: t.phone || '' }))]}
                    onChange={id => setFindForm({ ...findForm, tutor_id: id || 'any' })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Długość lekcji</label>
                <div className="flex gap-2">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setFindForm({ ...findForm, duration: d })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${findForm.duration === d ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'}`}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Preferowane dni (puste = wszystkie)</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_NAMES.map((dn, idx) => {
                    const on = findForm.weekdays.includes(idx)
                    return (
                      <button key={idx}
                        onClick={() => setFindForm({ ...findForm, weekdays: on ? findForm.weekdays.filter(w => w !== idx) : [...findForm.weekdays, idx] })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                        {dn}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Od godziny</label>
                  <input type="time" step={1800} value={findForm.from_hour}
                    onChange={e => setFindForm({ ...findForm, from_hour: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Do godziny</label>
                  <input type="time" step={1800} value={findForm.to_hour}
                    onChange={e => setFindForm({ ...findForm, to_hour: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>

              <button onClick={runFind} disabled={finding}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {finding ? 'Szukam...' : 'Szukaj wolnych terminów'}
              </button>

              {/* Wyniki */}
              {findSearched && !finding && (
                proposals.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">Brak wolnych terminów dla tych kryteriów. Poszerz zakres godzin lub dni.</p>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-gray-500">Propozycje (kliknij, aby utworzyć):</p>
                    {proposals.map((p, i) => (
                      <button key={i} onClick={() => openFromProposal(p)}
                        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-left hover:border-blue-400 hover:bg-blue-50 transition">
                        <div>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {new Date(p.date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'short' })}
                            {' · '}{p.start_time}
                          </p>
                          <p className="text-xs text-gray-500">{p.room} · {p.tutor_name}</p>
                        </div>
                        <Plus size={16} className="text-blue-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal kolizji (twardy, hasło) lub ostrzeżenia o dostępności (miękkie) */}
      {conflictModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            {conflictModal.kind === 'conflict' ? (
              <>
                <h3 className="font-bold text-gray-900 text-lg mb-1">⛔ Wykryto kolizję</h3>
                <p className="text-sm text-gray-600 mb-3">Te zajęcia nakładają się z:</p>
                <ul className="space-y-1.5 mb-4">
                  {conflictModal.messages.map((c, i) => (
                    <li key={i} className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{c}</li>
                  ))}
                </ul>
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Wymuszenie mimo kolizji — wymaga hasła właściciela
                  </label>
                  <input type="password" value={ownerPwd}
                    onChange={e => { setOwnerPwd(e.target.value); setOwnerPwdError(false) }}
                    placeholder="Hasło właściciela"
                    className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 ${ownerPwdError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                  {ownerPwdError && <p className="text-xs text-red-600 mt-1">Nieprawidłowe hasło właściciela</p>}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setConflictModal(null); setOwnerPwd(''); setOwnerPwdError(false) }}
                    className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Anuluj
                  </button>
                  <button onClick={() => { if (!ownerPwd) { setOwnerPwdError(true); return } handleSave(true, ownerPwd) }}
                    disabled={saving}
                    className="flex-1 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
                    {saving ? 'Zapisywanie...' : 'Wymuś mimo kolizji'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 text-lg mb-1">⚠️ Poza dostępnością</h3>
                <ul className="space-y-1.5 my-3">
                  {conflictModal.messages.map((c, i) => (
                    <li key={i} className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">{c}</li>
                  ))}
                </ul>
                <p className="text-sm text-gray-600 mb-4">Czy na pewno dodać te zajęcia mimo to?</p>
                <div className="flex gap-2">
                  <button onClick={() => setConflictModal(null)}
                    className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Anuluj
                  </button>
                  <button onClick={() => handleSave(false, undefined, true)} disabled={saving}
                    className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Zapisywanie...' : 'Dodaj mimo to'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal — identyczny dla obu widoków */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 text-lg">
                {modal.room} · {modal.start_time} · {new Date(modal.date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Sala — edytowalna w widoku tygodniowym */}
              {view === 'week' && !modal.lesson && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sala</label>
                  <select value={modal.room}
                    onChange={e => setModal({ ...modal, room: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500">
                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Godzina rozpoczęcia — dowolna (np. 12:30) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Godzina rozpoczęcia</label>
                <input type="time" step={300} value={modal.start_time}
                  onChange={e => setModal({ ...modal, start_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Koniec: {calcEndTime(modal.start_time, Number(form.duration_minutes))}</p>
              </div>

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
                <Combobox
                  value={form.tutor_id}
                  options={tutors.map(t => ({ id: t.id, label: t.name, sublabel: t.phone || t.email || '' }))}
                  onChange={id => {
                    const t = tutors.find(x => x.id === id)
                    const type = !form.is_group ? 'individual' : (groupCount() === 2 ? 'pair' : 'group')
                    setForm(f => ({ ...f, tutor_id: id, tutor_amount: f.tutor_amount || rateFor(t, type) }))
                  }}
                />
              </div>

              {/* Individual student */}
              {!form.is_group && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uczeń</label>
                    <Combobox
                      value={form.student_id}
                      options={students.map(s => ({ id: s.id, label: s.name, sublabel: s.phone || '' }))}
                      onChange={id => {
                        const s = students.find(x => x.id === id)
                        setForm(f => ({ ...f, student_id: id, amount_due: f.amount_due || rateFor(s, 'individual') }))
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kwota (zł)</label>
                    <input type="number" placeholder="np. 80" value={form.amount_due}
                      onChange={e => setForm({ ...form, amount_due: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              {/* Wybór zdefiniowanej grupy — uzupełnia przedmiot, czas trwania i uczniów zapisanych do tej grupy */}
              {form.is_group && courseGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zdefiniowana grupa (opcjonalnie)</label>
                  <select value={selectedCourseGroupId} onChange={e => {
                    const gid = e.target.value
                    setSelectedCourseGroupId(gid)
                    const g = courseGroups.find(x => x.id === gid)
                    if (!g) return
                    const tutorAmount = Math.round((g.tutor_rate_per_hour || 0) * (g.duration_minutes / 60))
                    setForm(f => ({
                      ...f, subject: g.subject, duration_minutes: String(g.duration_minutes),
                      lesson_type: g.is_maturzysta ? 'Kursy maturalne' : 'Zajęcia grupowe',
                      tutor_id: g.tutor_id || f.tutor_id, tutor_amount: String(tutorAmount),
                    }))
                    const memberEnrollments = allEnrollments
                      .filter(en => en.active && en.mode === 'group' && en.group_name?.trim() === g.name
                        && ['zapisany', 'aktywny'].includes(students.find(s => s.id === en.student_id)?.status || 'potencjalny'))
                    if (memberEnrollments.length > 0) {
                      setGroupEntries(memberEnrollments.map(en => ({
                        student_id: en.student_id,
                        amount_due: String(en.price ?? g.student_price ?? defaultStudentPrice(g.duration_minutes)),
                      })))
                    }
                  }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 mb-3">
                    <option value="">— wybierz grupę, żeby uzupełnić dane —</option>
                    {courseGroups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.subject}{g.level ? ` ${g.level}` : ''}{g.is_e8 ? ' E8' : ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Group students */}
              {form.is_group && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Uczniowie w grupie</label>
                  <div className="space-y-2">
                    {groupEntries.map((entry, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1">
                          <Combobox
                            value={entry.student_id}
                            accent="purple"
                            placeholder="— uczeń —"
                            options={students.map(s => ({ id: s.id, label: s.name, sublabel: s.phone || '' }))}
                            onChange={id => {
                              const ne = [...groupEntries]; ne[i].student_id = id
                              const count = ne.filter(g => g.student_id).length
                              const s = students.find(x => x.id === id)
                              if (!ne[i].amount_due) ne[i].amount_due = rateFor(s, count === 2 ? 'pair' : 'group')
                              setGroupEntries(ne)
                            }}
                          />
                        </div>
                        <input type="number" placeholder="zł" value={entry.amount_due}
                          onChange={e => { const ne = [...groupEntries]; ne[i].amount_due = e.target.value; setGroupEntries(ne) }}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-purple-500" />
                        {groupEntries.length > 1 && (
                          <button onClick={() => setGroupEntries(groupEntries.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
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
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={form.count_earnings}
                    onChange={e => setForm({ ...form, count_earnings: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">Liczyć do zarobków korepetytora</span>
                </label>
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
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${form.duration_minutes === String(d) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Repeat */}
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
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${form.repeat_weeks === String(opt.value) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'}`}>
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
                <button onClick={() => { setDeleteScope('this'); setDeleteConfirm(true) }} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">Usuń</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={() => handleSave()} disabled={saving}
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
