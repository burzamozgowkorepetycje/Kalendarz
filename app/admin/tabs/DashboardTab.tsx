'use client'

import { useState, useEffect } from 'react'
import { Calendar, AlertCircle, TrendingUp, Users, RotateCw, UserCheck, UserPlus, Monitor, MapPin, GraduationCap, ClipboardCheck, UserMinus, UsersRound, Clock, X } from 'lucide-react'
import { Student, StudentEnrollment, CourseGroup, Tutor } from '@/lib/types'
import { defaultStudentPrice, defaultTutorRatePerHour } from '@/lib/pricing'

// Pojemność lokalu: 6 sal × 6h (14–20) × 5 dni (pon–pt) = 180 roboczogodzin/tydzień
const VENUE_CAPACITY_H = 6 * 6 * 5

const STATUS_ORDER = ['potencjalny', 'zapisany', 'aktywny', 'zawieszony', 'zakończył'] as const
const STATUS_BADGE: Record<string, string> = {
  potencjalny: 'bg-gray-100 text-gray-700',
  zapisany: 'bg-blue-100 text-blue-700',
  aktywny: 'bg-green-100 text-green-700',
  zawieszony: 'bg-orange-100 text-orange-700',
  'zakończył': 'bg-red-100 text-red-700',
}

interface TodayLesson {
  id: string
  date: string
  start_time: string
  end_time: string
  tutor_id: string | null
  student_id: string | null
  is_group: boolean
  room: string | null
  amount_due: number | null
  tutors?: { name: string }
  students?: { name: string }
}

interface PendingPayment {
  student_id: string
  name: string
  balance: number
}

interface DashboardStats {
  todayLessons: TodayLesson[]
  pendingPayments: PendingPayment[]
  yesterdayAbsences: number
  activeStudents: number
}

interface SchoolStats {
  totalActiveStudents: number
  totalStudentsInDb: number
  newThisMonth: number
  individualStudents: number
  groupEnrollments: number
  onlineStudents: number
  onsiteStudents: number
  maturzysci: number
  e8: number
  resignationsThisMonth: number
  byStatus: Record<string, number>
  fillIndividualH: number
  fillGroupH: number
  fillTotalH: number
  fillPercent: number
  onlineIndividualH: number
  onlineGroupH: number
  onlineTotalH: number
}

export default function DashboardTab({ password }: { password: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [schoolStats, setSchoolStats] = useState<SchoolStats | null>(null)
  const [loading, setLoading] = useState(false)
  // Aktywne zapisy (tylko aktywni uczniowie) — do rozbicia po przedmiotach
  const [activeEnr, setActiveEnr] = useState<StudentEnrollment[]>([])
  const [detail, setDetail] = useState<{ title: string; predicate: (e: StudentEnrollment) => boolean } | null>(null)
  // Wszystkie aktywne zapisy grupowe (niezależnie od statusu ucznia) — śledzenie zgłoszeń na kursy przed harmonogramem
  const [groupSignups, setGroupSignups] = useState<StudentEnrollment[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({})
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [showGroupsPanel, setShowGroupsPanel] = useState(false)
  const [showSignupsPanel, setShowSignupsPanel] = useState(false)
  // Zdefiniowane grupy — rezerwują miejsce w grafiku niezależnie od liczby przypisanych uczniów
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [savingGroup, setSavingGroup] = useState(false)
  const [newGroup, setNewGroup] = useState({
    name: '', subject: '', location: 'Wyszków' as 'Wyszków' | 'Online', duration_minutes: 60,
    is_maturzysta: false, is_e8: false, level: '' as '' | 'podstawowa' | 'rozszerzona',
    tutor_rate_per_hour: '0', student_price: String(defaultStudentPrice(60)), tutor_id: '',
  })
  // Czy admin ręcznie zmienił stawki — jeśli nie, dociągamy sugerowane wartości przy zmianie przedmiotu/czasu
  const [groupRatesTouched, setGroupRatesTouched] = useState(false)
  const [editingGroupDefId, setEditingGroupDefId] = useState<string | null>(null)
  const [editGroupForm, setEditGroupForm] = useState({
    name: '', subject: '', location: 'Wyszków' as 'Wyszków' | 'Online', duration_minutes: 60,
    is_maturzysta: false, is_e8: false, level: '' as '' | 'podstawowa' | 'rozszerzona',
    tutor_rate_per_hour: '0', student_price: '', tutor_id: '',
  })
  const [savingGroupEdit, setSavingGroupEdit] = useState(false)
  const [groupEarnings, setGroupEarnings] = useState<Record<string, { lessonsCount: number; studentRevenue: number; tutorCost: number }>>({})
  const [priceHistory, setPriceHistory] = useState<{ tutor: { old_value: number | null; new_value: number | null; changed_at: string }[]; student: { old_value: number | null; new_value: number | null; changed_at: string }[] }>({ tutor: [], student: [] })

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const loadSchoolStats = async () => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const studentsRes = await fetch('/api/admin/students', { headers })
    const students: Student[] = studentsRes.ok ? await studentsRes.json() : []

    const enrollmentsRes = await fetch('/api/admin/enrollments', { headers })
    const enrollments: StudentEnrollment[] = enrollmentsRes.ok ? await enrollmentsRes.json() : []

    const groupsRes = await fetch('/api/admin/course-groups', { headers })
    const groups: CourseGroup[] = groupsRes.ok ? await groupsRes.json() : []
    setCourseGroups(groups)

    const tutorsRes = await fetch('/api/admin/tutors', { headers })
    setTutors(tutorsRes.ok ? await tutorsRes.json() : [])

    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const earningsRes = await fetch(`/api/admin/course-groups/earnings?from=${monthStart}&to=${monthEnd}`, { headers })
    const earnings = earningsRes.ok ? await earningsRes.json() : []
    setGroupEarnings(Object.fromEntries(earnings.map((e: any) => [e.course_group_id, e])))

    // Wypełnienie: indywidualne zapisy liczą się wprost z zapisów uczniów.
    // Grupowe: liczą się WYŁĄCZNIE zdefiniowane grupy (course_groups) — grupa
    // rezerwuje miejsce sama w sobie, niezależnie od liczby przypisanych uczniów.
    // Zapisy grupowe bez przydziału (oczekujący) NIE zajmują dodatkowego miejsca.
    const fillFor = (loc: 'Wyszków' | 'Online') => {
      const individualH = enrollments
        .filter(e => e.active && e.location === loc && e.mode === 'individual')
        .reduce((s, e) => s + (e.duration_minutes || 60), 0) / 60
      const groupH = groups
        .filter(g => g.active && g.location === loc)
        .reduce((s, g) => s + (g.duration_minutes || 60), 0) / 60
      return { individualH, groupH, totalH: individualH + groupH }
    }
    const venue = fillFor('Wyszków')
    const online = fillFor('Online')
    const fillIndividualH = venue.individualH
    const fillGroupH = venue.groupH
    const fillTotalH = venue.totalH
    const fillPercent = (fillTotalH / VENUE_CAPACITY_H) * 100
    const onlineIndividualH = online.individualH
    const onlineGroupH = online.groupH
    const onlineTotalH = online.totalH

    // Aktywni uczniowie (status = aktywny) — wszystkie statystyki oprócz "w bazie" liczą tylko ich
    const activeStudentIds = new Set(students.filter(s => s.status === 'aktywny').map(s => s.id))
    const activeStudents = students.filter(s => s.status === 'aktywny')
    // Zapisy tylko aktywnych uczniów (i aktywne zapisy)
    const activeEnrollments = enrollments.filter(e => e.active && activeStudentIds.has(e.student_id))
    setActiveEnr(activeEnrollments)
    const uniqueIds = (list: StudentEnrollment[]) => new Set(list.map(e => e.student_id)).size

    // Wszystkie aktywne zapisy grupowe — niezależnie od statusu ucznia (śledzenie zgłoszeń na kursy),
    // ale UI musi wyraźnie rozdzielać zapisanych (zobowiązanie) od potencjalnych (samo zainteresowanie)
    setGroupSignups(enrollments.filter(e => e.active && e.mode === 'group'))
    setStudentNames(Object.fromEntries(students.map(s => [s.id, s.name])))
    setStudentStatuses(Object.fromEntries(students.map(s => [s.id, s.status || 'potencjalny'])))

    const totalStudentsInDb = students.length
    const newThisMonth = students.filter(s => s.created_at?.startsWith(thisMonth)).length
    const totalActiveStudents = activeStudents.length
    // Online / stacjonarni — tylko aktywni uczniowie wg lokalizacji z karty
    const onlineStudents = activeStudents.filter(s => s.location === 'Online').length
    const onsiteStudents = activeStudents.filter(s => s.location === 'Wyszków').length
    const byStatus: Record<string, number> = {}
    for (const s of students) {
      const st = s.status || 'potencjalny'
      byStatus[st] = (byStatus[st] || 0) + 1
    }
    // Zapisy na przedmioty (tylko aktywni uczniowie)
    const individualStudents = uniqueIds(activeEnrollments.filter(e => e.mode === 'individual'))
    const groupEnrollments = activeEnrollments.filter(e => e.mode === 'group').length
    // Maturzyści / E8 = kursy (zajęcia grupowe)
    const maturzysci = uniqueIds(activeEnrollments.filter(e => e.is_maturzysta && e.mode === 'group'))
    const e8 = uniqueIds(activeEnrollments.filter(e => e.is_e8 && e.mode === 'group'))
    // Rezygnacje: anulowane zapisy w tym miesiącu
    const resignationsThisMonth = enrollments.filter(e => e.cancelled_at?.startsWith(thisMonth)).length

    setSchoolStats({
      totalActiveStudents, totalStudentsInDb, newThisMonth, individualStudents,
      groupEnrollments, onlineStudents, onsiteStudents, maturzysci, e8, resignationsThisMonth,
      byStatus, fillIndividualH, fillGroupH, fillTotalH, fillPercent,
      onlineIndividualH, onlineGroupH, onlineTotalH,
    })
  }

  const addCourseGroup = async () => {
    if (!newGroup.name.trim() || !newGroup.subject) return
    setSavingGroup(true)
    const res = await fetch('/api/admin/course-groups', {
      method: 'POST', headers,
      body: JSON.stringify({
        ...newGroup, level: newGroup.level || null,
        tutor_rate_per_hour: Number(newGroup.tutor_rate_per_hour) || 0,
        student_price: newGroup.student_price ? Number(newGroup.student_price) : null,
        tutor_id: newGroup.tutor_id || null,
      }),
    })
    if (res.ok) {
      setNewGroup({ name: '', subject: '', location: 'Wyszków', duration_minutes: 60, is_maturzysta: false, is_e8: false, level: '', tutor_rate_per_hour: '0', student_price: String(defaultStudentPrice(60)), tutor_id: '' })
      setGroupRatesTouched(false)
      await loadSchoolStats()
    }
    setSavingGroup(false)
  }

  // Zysk grupy: suma cen zapisanych/aktywnych uczniów (cena z zapisu lub domyślna grupy) minus koszt korepetytora
  const groupProfit = (g: CourseGroup) => {
    const members = groupSignups
      .filter(e => e.group_name?.trim() === g.name && ['zapisany', 'aktywny'].includes(studentStatuses[e.student_id] || 'potencjalny'))
      .map(e => ({ enrollmentId: e.id, studentId: e.student_id, name: studentNames[e.student_id] || '—', price: e.price ?? g.student_price ?? defaultStudentPrice(g.duration_minutes) }))
    const revenue = members.reduce((sum, m) => sum + m.price, 0)
    const tutorCost = (g.tutor_rate_per_hour || 0) * (g.duration_minutes / 60)
    return { revenue, tutorCost, profit: revenue - tutorCost, memberCount: members.length, members }
  }

  const startEditGroup = (g: CourseGroup) => {
    setEditingGroupDefId(g.id)
    setShowGroupForm(false)
    setEditGroupForm({
      name: g.name, subject: g.subject, location: g.location, duration_minutes: g.duration_minutes,
      is_maturzysta: g.is_maturzysta, is_e8: g.is_e8, level: g.level || '',
      tutor_rate_per_hour: String(g.tutor_rate_per_hour ?? 0),
      student_price: String(g.student_price ?? defaultStudentPrice(g.duration_minutes)),
      tutor_id: g.tutor_id || '',
    })
    Promise.all([
      fetch(`/api/admin/price-history?entity_type=group_tutor_rate&entity_id=${g.id}`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/price-history?entity_type=group_student_price&entity_id=${g.id}`, { headers }).then(r => r.ok ? r.json() : []),
    ]).then(([tutor, student]) => setPriceHistory({ tutor, student }))
  }

  const saveGroupEdit = async () => {
    if (!editingGroupDefId || !editGroupForm.name.trim() || !editGroupForm.subject) return
    setSavingGroupEdit(true)
    const res = await fetch('/api/admin/course-groups', {
      method: 'PUT', headers,
      body: JSON.stringify({
        id: editingGroupDefId, ...editGroupForm, level: editGroupForm.level || null,
        tutor_rate_per_hour: Number(editGroupForm.tutor_rate_per_hour) || 0,
        student_price: editGroupForm.student_price ? Number(editGroupForm.student_price) : null,
        tutor_id: editGroupForm.tutor_id || null,
      }),
    })
    if (res.ok) {
      setEditingGroupDefId(null)
      await loadSchoolStats()
    }
    setSavingGroupEdit(false)
  }

  const deactivateCourseGroup = async (id: string) => {
    if (!confirm('Usunąć tę grupę? Przestanie zajmować miejsce w grafiku.')) return
    const res = await fetch(`/api/admin/course-groups?id=${id}`, { method: 'DELETE', headers })
    if (res.ok) await loadSchoolStats()
  }

  const loadDashboard = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Zajęcia dzisiaj
    const lessonsRes = await fetch(`/api/admin/lessons?from=${today}&to=${today}`, { headers })
    const todayLessons = lessonsRes.ok ? (await lessonsRes.json()) : []

    // Zaległe płatności
    const paymentsRes = await fetch(`/api/admin/reports?type=payments&from=${today}&to=${today}`, { headers })
    const paymentData = paymentsRes.ok ? (await paymentsRes.json()) : []
    const pendingPayments = paymentData.filter((r: any) => r.balance > 0).slice(0, 5)

    // Nieobecności wczoraj
    const yesterdayRes = await fetch(`/api/admin/lessons?from=${yesterday}&to=${yesterday}`, { headers })
    const yesterdayLessons = yesterdayRes.ok ? (await yesterdayRes.json()) : []
    const yesterdayAbsences = yesterdayLessons.filter((l: any) => l.attendance === 'absent').length

    // Liczba aktywnych uczniów
    const studentsRes = await fetch(`/api/admin/students`, { headers })
    const students = studentsRes.ok ? (await studentsRes.json()) : []
    const activeStudents = students.length

    setStats({
      todayLessons: todayLessons.sort((a: TodayLesson, b: TodayLesson) =>
        a.start_time.localeCompare(b.start_time)
      ),
      pendingPayments,
      yesterdayAbsences,
      activeStudents,
    })
    await loadSchoolStats()
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Ładowanie...</div>
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">Brak danych</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Przegląd dzisiaj</h2>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Ładowanie...' : 'Odśwież'}
        </button>
      </div>

      {/* Panel główny — statystyki szkółki */}
      {schoolStats && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Panel główny</h3>

          {/* Rozbicie po statusach ucznia */}
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUS_ORDER.map(st => (
              <div key={st} className={`px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_BADGE[st]}`}>
                {st}: <span className="font-bold">{schoolStats.byStatus[st] || 0}</span>
              </div>
            ))}
          </div>

          {/* Wypełnienie lokalu (roboczogodziny tygodniowo z zapisów) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Clock size={16} className="text-gray-400" /> Wypełnienie lokalu (Wyszków) — tygodniowo z zapisów</p>
              <p className="text-2xl font-bold text-gray-900">{schoolStats.fillTotalH.toFixed(1)} h</p>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Pojemność: {VENUE_CAPACITY_H} h/tydz (6 sal × 14–20 × pon–pt)</p>
              <p className={`text-sm font-bold ${schoolStats.fillPercent >= 100 ? 'text-red-600' : schoolStats.fillPercent >= 80 ? 'text-orange-600' : 'text-green-600'}`}>
                {schoolStats.fillPercent.toFixed(0)}% wypełnienia
              </p>
            </div>
            {/* Pasek wypełnienia względem pojemności (może przekroczyć 100%) */}
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden mb-2 relative">
              <div className={`h-full ${schoolStats.fillPercent >= 100 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(schoolStats.fillPercent, 100)}%` }} />
              {schoolStats.fillPercent > 100 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  przekroczono ({schoolStats.fillPercent.toFixed(0)}%)
                </div>
              )}
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Indywidualne: <span className="font-semibold">{schoolStats.fillIndividualH.toFixed(1)} h</span></span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Grupowe: <span className="font-semibold">{schoolStats.fillGroupH.toFixed(1)} h</span></span>
            </div>
          </div>

          {/* Zdefiniowane grupy — rezerwują miejsce niezależnie od liczby przypisanych uczniów */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <button onClick={() => setShowGroupsPanel(!showGroupsPanel)} className="w-full flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-700">
                Zdefiniowane grupy <span className="text-gray-400 font-normal">({courseGroups.filter(g => g.active).length})</span>
              </p>
              <span className="text-gray-300 text-xs">{showGroupsPanel ? '▲ zwiń' : '▼ rozwiń'}</span>
            </button>
            {!showGroupsPanel && schoolStats.fillGroupH > 0 && (
              <p className="text-xs text-gray-500">Grupowe: {schoolStats.fillGroupH.toFixed(1)} h zarezerwowane w lokalu</p>
            )}
            {showGroupsPanel && (
            <>
            <div className="flex items-center justify-end mb-1">
              <button onClick={() => setShowGroupForm(!showGroupForm)}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100">
                {showGroupForm ? 'Anuluj' : '+ Nowa grupa'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Grupa zajmuje miejsce w grafiku od razu po utworzeniu — niezależnie od tego, ilu uczniów jest do niej przypisanych. Zapisy bez przydziału (lista oczekujących) nie zajmują dodatkowego miejsca.</p>

            {showGroupForm && (
              <div className="grid grid-cols-2 gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                <input value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Nazwa grupy (np. Matura R - Matematyka - gr. 1)"
                  className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400" />
                <select value={newGroup.subject} onChange={e => {
                    const subject = e.target.value
                    setNewGroup(g => ({ ...g, subject, tutor_rate_per_hour: groupRatesTouched ? g.tutor_rate_per_hour : String(defaultTutorRatePerHour(subject)) }))
                  }}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                  <option value="">Przedmiot...</option>
                  {['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS', 'Niemiecki'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={newGroup.location} onChange={e => setNewGroup({ ...newGroup, location: e.target.value as 'Wyszków' | 'Online' })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                  <option value="Wyszków">Wyszków</option>
                  <option value="Online">Online</option>
                </select>
                <select value={newGroup.duration_minutes} onChange={e => {
                    const duration_minutes = Number(e.target.value)
                    setNewGroup(g => ({ ...g, duration_minutes, student_price: groupRatesTouched ? g.student_price : String(defaultStudentPrice(duration_minutes)) }))
                  }}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                  {[30, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
                <div>
                  <label className="text-xs text-gray-500">Cena ucznia / zajęcia (zł)</label>
                  <input type="number" value={newGroup.student_price}
                    onChange={e => { setGroupRatesTouched(true); setNewGroup({ ...newGroup, student_price: e.target.value }) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Stawka korepetytora / h (zł)</label>
                  <input type="number" value={newGroup.tutor_rate_per_hour}
                    onChange={e => { setGroupRatesTouched(true); setNewGroup({ ...newGroup, tutor_rate_per_hour: e.target.value }) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                </div>
                <select value={newGroup.tutor_id} onChange={e => setNewGroup({ ...newGroup, tutor_id: e.target.value })}
                  className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                  <option value="">Korepetytor prowadzący (nieprzypisany)</option>
                  {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={newGroup.is_maturzysta}
                      onChange={e => setNewGroup({ ...newGroup, is_maturzysta: e.target.checked, level: e.target.checked ? newGroup.level : '' })} />
                    Maturzysta
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={newGroup.is_e8}
                      onChange={e => setNewGroup({ ...newGroup, is_e8: e.target.checked })} />
                    E8
                  </label>
                </div>
                {newGroup.is_maturzysta && (
                  <select value={newGroup.level} onChange={e => setNewGroup({ ...newGroup, level: e.target.value as '' | 'podstawowa' | 'rozszerzona' })}
                    className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                    <option value="">Poziom (nieokreślony)</option>
                    <option value="podstawowa">Podstawowa</option>
                    <option value="rozszerzona">Rozszerzona</option>
                  </select>
                )}
                <button onClick={addCourseGroup} disabled={savingGroup || !newGroup.name.trim() || !newGroup.subject}
                  className="col-span-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {savingGroup ? 'Zapisywanie...' : '+ Utwórz grupę'}
                </button>
              </div>
            )}

            {courseGroups.filter(g => g.active).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Brak zdefiniowanych grup</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {courseGroups.filter(g => g.active).map(g => {
                  const { revenue, tutorCost, profit, memberCount } = groupProfit(g)
                  if (editingGroupDefId === g.id) {
                    const { members, revenue } = groupProfit(g)
                    const real = groupEarnings[g.id]
                    return (
                      <div key={g.id} className="py-2 grid grid-cols-2 gap-2 p-3 bg-blue-50 rounded-lg mb-1">
                        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-2">
                          <p className="text-xs font-semibold text-gray-600 mb-1">Uczestnicy ({members.length})</p>
                          {members.length === 0 ? (
                            <p className="text-xs text-gray-400">Brak zapisanych/aktywnych uczniów w tej grupie</p>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {members.map(m => (
                                <div key={m.enrollmentId} className="flex items-center justify-between py-1 text-xs text-gray-700">
                                  <span>{m.name}</span>
                                  <span className="font-medium">{m.price} zł</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {members.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1 pt-1 border-t border-gray-100">Razem: <span className="font-semibold">{revenue} zł</span></p>
                          )}
                        </div>
                        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-2">
                          <p className="text-xs font-semibold text-gray-600 mb-1">Realny zysk (ten miesiąc, z zajęć w kalendarzu)</p>
                          {!real || real.lessonsCount === 0 ? (
                            <p className="text-xs text-gray-400">Brak odbytych/zaplanowanych zajęć tej grupy w tym miesiącu</p>
                          ) : (
                            <p className="text-xs text-gray-700">
                              {real.lessonsCount} {real.lessonsCount === 1 ? 'zajęcia' : 'zajęć'} · przychód {real.studentRevenue} zł − koszt {real.tutorCost} zł ={' '}
                              <span className={real.studentRevenue - real.tutorCost >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                zysk {(real.studentRevenue - real.tutorCost).toFixed(0)} zł
                              </span>
                            </p>
                          )}
                        </div>
                        {(priceHistory.tutor.length > 0 || priceHistory.student.length > 0) && (
                          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-2">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Historia zmian stawek</p>
                            <div className="space-y-0.5">
                              {priceHistory.tutor.map((h, i) => (
                                <p key={`t${i}`} className="text-xs text-gray-500">
                                  {new Date(h.changed_at).toLocaleDateString('pl-PL')}: korepetytor {h.old_value ?? '—'} → {h.new_value ?? '—'} zł/h
                                </p>
                              ))}
                              {priceHistory.student.map((h, i) => (
                                <p key={`s${i}`} className="text-xs text-gray-500">
                                  {new Date(h.changed_at).toLocaleDateString('pl-PL')}: cena ucznia {h.old_value ?? '—'} → {h.new_value ?? '—'} zł
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        <input value={editGroupForm.name} onChange={e => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                          placeholder="Nazwa grupy"
                          className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                        <select value={editGroupForm.subject} onChange={e => setEditGroupForm({ ...editGroupForm, subject: e.target.value })}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                          {['Matematyka', 'Angielski', 'Polski', 'Hiszpański', 'Geografia', 'Biologia', 'Chemia', 'WOS', 'Niemiecki'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={editGroupForm.location} onChange={e => setEditGroupForm({ ...editGroupForm, location: e.target.value as 'Wyszków' | 'Online' })}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                          <option value="Wyszków">Wyszków</option>
                          <option value="Online">Online</option>
                        </select>
                        <select value={editGroupForm.duration_minutes} onChange={e => setEditGroupForm({ ...editGroupForm, duration_minutes: Number(e.target.value) })}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                          {[30, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                        </select>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <label className="flex items-center gap-1">
                            <input type="checkbox" checked={editGroupForm.is_maturzysta}
                              onChange={e => setEditGroupForm({ ...editGroupForm, is_maturzysta: e.target.checked, level: e.target.checked ? editGroupForm.level : '' })} />
                            Maturzysta
                          </label>
                          <label className="flex items-center gap-1">
                            <input type="checkbox" checked={editGroupForm.is_e8}
                              onChange={e => setEditGroupForm({ ...editGroupForm, is_e8: e.target.checked })} />
                            E8
                          </label>
                        </div>
                        {editGroupForm.is_maturzysta && (
                          <select value={editGroupForm.level} onChange={e => setEditGroupForm({ ...editGroupForm, level: e.target.value as '' | 'podstawowa' | 'rozszerzona' })}
                            className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                            <option value="">Poziom (nieokreślony)</option>
                            <option value="podstawowa">Podstawowa</option>
                            <option value="rozszerzona">Rozszerzona</option>
                          </select>
                        )}
                        <div>
                          <label className="text-xs text-gray-500">Cena ucznia / zajęcia (zł)</label>
                          <input type="number" value={editGroupForm.student_price}
                            onChange={e => setEditGroupForm({ ...editGroupForm, student_price: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Stawka korepetytora / h (zł)</label>
                          <input type="number" value={editGroupForm.tutor_rate_per_hour}
                            onChange={e => setEditGroupForm({ ...editGroupForm, tutor_rate_per_hour: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                        </div>
                        <select value={editGroupForm.tutor_id} onChange={e => setEditGroupForm({ ...editGroupForm, tutor_id: e.target.value })}
                          className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900">
                          <option value="">Korepetytor prowadzący (nieprzypisany)</option>
                          {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <div className="col-span-2 flex gap-2">
                          <button onClick={saveGroupEdit} disabled={savingGroupEdit || !editGroupForm.name.trim() || !editGroupForm.subject}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                            {savingGroupEdit ? 'Zapisywanie...' : 'Zapisz zmiany'}
                          </button>
                          <button onClick={() => setEditingGroupDefId(null)}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300">Anuluj</button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={g.id} className="py-2 flex items-center justify-between text-sm">
                      <button onClick={() => startEditGroup(g)} className="text-left flex-1 hover:opacity-75">
                        <p className="font-medium text-gray-800">{g.name}</p>
                        <p className="text-xs text-gray-500">
                          {g.subject}{g.level ? ` (${g.level})` : ''} · {g.location} · {g.duration_minutes} min
                          {g.is_maturzysta && ' · maturzysta'}{g.is_e8 && ' · E8'} · {memberCount} {memberCount === 1 ? 'uczeń' : 'uczniów'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {g.student_price ?? defaultStudentPrice(g.duration_minutes)} zł/os · {g.tutor_id ? (tutors.find(t => t.id === g.tutor_id)?.name || 'korepetytor') : 'brak korepetytora'} {g.tutor_rate_per_hour}/h
                          {' · '}przychód {revenue} zł − koszt {tutorCost.toFixed(0)} zł ={' '}
                          <span className={profit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>zysk {profit.toFixed(0)} zł</span>
                        </p>
                      </button>
                      <button onClick={() => deactivateCourseGroup(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                        <X size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            </>
            )}
          </div>

          {/* Godziny online (bez limitu pojemności) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Monitor size={16} className="text-gray-400" /> Zajęcia online — tygodniowo z zapisów</p>
              <p className="text-2xl font-bold text-cyan-600">{schoolStats.onlineTotalH.toFixed(1)} h</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Indywidualne: <span className="font-semibold">{schoolStats.onlineIndividualH.toFixed(1)} h</span></span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Grupowe: <span className="font-semibold">{schoolStats.onlineGroupH.toFixed(1)} h</span></span>
            </div>
          </div>

          {/* Kursy grupowe — status zapisów (przed ustaleniem harmonogramu) */}
          {groupSignups.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <button onClick={() => setShowSignupsPanel(!showSignupsPanel)} className="w-full flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-700">Kursy grupowe — status zapisów</p>
                <span className="text-gray-300 text-xs">{showSignupsPanel ? '▲ zwiń' : '▼ rozwiń'}</span>
              </button>
              {showSignupsPanel && (
              <>
              <p className="text-xs text-gray-400 mb-3">
                Liczba przy przedmiocie to <strong>zapisani</strong> (status: zapisany / aktywny) — to oni realnie się liczą.
                Potencjalni (samo zainteresowanie, jeszcze nie zapisani) są pokazani osobno i nie wliczają się do statystyk.
              </p>
              {(() => {
                const isEnrolled = (sid: string) => ['zapisany', 'aktywny'].includes(studentStatuses[sid] || 'potencjalny')
                const isProspect = (sid: string) => (studentStatuses[sid] || 'potencjalny') === 'potencjalny'

                // Grupuj po przedmiocie + poziomie → dalej po nazwie grupy (lub "oczekujący"), tylko wśród ZAPISANYCH
                type Row = { name: string; ids: Set<string> }
                const subjectKey = (e: StudentEnrollment) => e.subject + (e.level ? ` (${e.level})` : '')
                const bySubject = new Map<string, Map<string, Row>>()
                const prospectsBySubject = new Map<string, Set<string>>()
                for (const e of groupSignups) {
                  const sk = subjectKey(e)
                  if (isEnrolled(e.student_id)) {
                    if (!bySubject.has(sk)) bySubject.set(sk, new Map())
                    const groups = bySubject.get(sk)!
                    const key = e.group_name?.trim() || '__waiting'
                    if (!groups.has(key)) groups.set(key, { name: e.group_name?.trim() || 'Oczekujący na przydział', ids: new Set() })
                    groups.get(key)!.ids.add(e.student_id)
                  } else if (isProspect(e.student_id)) {
                    if (!prospectsBySubject.has(sk)) prospectsBySubject.set(sk, new Set())
                    prospectsBySubject.get(sk)!.add(e.student_id)
                  }
                }
                const allSubjectKeys = new Set([...bySubject.keys(), ...prospectsBySubject.keys()])
                const subjects = Array.from(allSubjectKeys)
                  .map(subject => {
                    const groups = bySubject.get(subject) || new Map<string, Row>()
                    const groupRows = Array.from(groups.entries())
                    const enrolledTotal = new Set(groupRows.flatMap(([, r]) => Array.from(r.ids))).size
                    const prospectIds = Array.from(prospectsBySubject.get(subject) || [])
                    return { subject, enrolledTotal, groupRows, prospectIds }
                  })
                  .sort((a, b) => b.enrolledTotal - a.enrolledTotal)
                return (
                  <div className="divide-y divide-gray-100">
                    {subjects.map(({ subject, enrolledTotal, groupRows, prospectIds }) => (
                      <div key={subject} className="py-2">
                        <button onClick={() => setExpandedCourse(expandedCourse === subject ? null : subject)}
                          className="w-full flex items-center justify-between text-sm hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2">
                          <span className="font-medium text-gray-800">{subject}</span>
                          <span className="text-gray-500">
                            <strong className="text-gray-900">{enrolledTotal}</strong> {enrolledTotal === 1 ? 'zapisany' : 'zapisanych'}
                            {prospectIds.length > 0 && <span className="text-gray-400"> · {prospectIds.length} potencjalnych</span>}
                            {' '}<span className="text-gray-300">{expandedCourse === subject ? '▲' : '▼'}</span>
                          </span>
                        </button>
                        {expandedCourse === subject && (
                          <div className="mt-1 ml-2 space-y-1.5">
                            {groupRows
                              .sort(([ka], [kb]) => ka === '__waiting' ? 1 : kb === '__waiting' ? -1 : ka.localeCompare(kb))
                              .map(([key, row]) => (
                                <div key={key} className={`px-3 py-2 rounded-lg text-xs ${key === '__waiting' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                                  <p className={`font-medium mb-1 ${key === '__waiting' ? 'text-amber-700' : 'text-blue-700'}`}>
                                    {key === '__waiting' ? '⏳ ' : ''}{row.name} <span className="font-normal text-gray-500">({row.ids.size})</span>
                                  </p>
                                  <p className="text-gray-600">
                                    {Array.from(row.ids).map(id => studentNames[id] || '—').join(', ')}
                                  </p>
                                </div>
                              ))}
                            {prospectIds.length > 0 && (
                              <div className="px-3 py-2 rounded-lg text-xs bg-gray-50 border border-dashed border-gray-200">
                                <p className="font-medium mb-1 text-gray-500">💭 Potencjalni — nie liczą się jako zapisy ({prospectIds.length})</p>
                                <p className="text-gray-500">{prospectIds.map(id => studentNames[id] || '—').join(', ')}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
              </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={<UserCheck size={20} className="text-blue-400" />} label="Aktywnych uczniów" value={schoolStats.totalActiveStudents} color="text-blue-600" />
            <StatCard icon={<Users size={20} className="text-gray-400" />} label="Wszyscy w bazie" value={schoolStats.totalStudentsInDb} color="text-gray-700" />
            <StatCard icon={<UserPlus size={20} className="text-green-400" />} label="Nowi w tym miesiącu" value={schoolStats.newThisMonth} color="text-green-600" />
            <StatCard icon={<Users size={20} className="text-indigo-400" />} label="Uczniowie indywidualni" value={schoolStats.individualStudents} color="text-indigo-600"
              onClick={() => setDetail({ title: 'Indywidualni wg przedmiotu', predicate: e => e.mode === 'individual' })} />
            <StatCard icon={<UsersRound size={20} className="text-purple-400" />} label="Zapisy grupowe" value={schoolStats.groupEnrollments} color="text-purple-600"
              onClick={() => setDetail({ title: 'Grupowe wg przedmiotu', predicate: e => e.mode === 'group' })} />
            <StatCard icon={<Monitor size={20} className="text-cyan-400" />} label="Uczniowie online" value={schoolStats.onlineStudents} color="text-cyan-600" />
            <StatCard icon={<MapPin size={20} className="text-teal-400" />} label="Stacjonarni (Wyszków)" value={schoolStats.onsiteStudents} color="text-teal-600" />
            <StatCard icon={<GraduationCap size={20} className="text-amber-400" />} label="Maturzyści" value={schoolStats.maturzysci} color="text-amber-600"
              onClick={() => setDetail({ title: 'Kursy maturalne wg przedmiotu', predicate: e => e.is_maturzysta && e.mode === 'group' })} />
            <StatCard icon={<ClipboardCheck size={20} className="text-pink-400" />} label="Przygotowanie do E8" value={schoolStats.e8} color="text-pink-600"
              onClick={() => setDetail({ title: 'Egzamin ósmoklasisty wg przedmiotu', predicate: e => e.is_e8 && e.mode === 'group' })} />
            <StatCard icon={<UserMinus size={20} className="text-red-400" />} label="Rezygnacje w tym miesiącu" value={schoolStats.resignationsThisMonth} color="text-red-600" />
          </div>
        </div>
      )}

      {/* Modal rozbicia po przedmiotach */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{detail.title}</h3>
              <button onClick={() => setDetail(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-100">
              {(() => {
                // Grupuj po przedmiocie + poziomie, licz unikalnych uczniów
                const matching = activeEnr.filter(detail.predicate)
                const bySubject = new Map<string, Set<string>>()
                for (const e of matching) {
                  const sk = e.subject + (e.level ? ` (${e.level})` : '')
                  if (!bySubject.has(sk)) bySubject.set(sk, new Set())
                  bySubject.get(sk)!.add(e.student_id)
                }
                const rows = Array.from(bySubject.entries())
                  .map(([subject, ids]) => ({ subject, count: ids.size }))
                  .sort((a, b) => b.count - a.count)
                if (rows.length === 0) return <p className="px-5 py-8 text-center text-gray-400 text-sm">Brak zapisów</p>
                return rows.map(r => (
                  <div key={r.subject} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-800">{r.subject}</span>
                    <span className="text-sm font-semibold text-gray-900">{r.count} {r.count === 1 ? 'uczeń' : 'uczniów'}</span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Przegląd dzisiaj</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Zajęcia dzisiaj</p>
              <p className="text-2xl font-bold text-blue-600">{stats.todayLessons.length}</p>
            </div>
            <Calendar size={24} className="text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Do zebrania</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.pendingPayments.reduce((s, p) => s + p.balance, 0)} zł
              </p>
            </div>
            <TrendingUp size={24} className="text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Nieobecni wczoraj</p>
              <p className="text-2xl font-bold text-orange-600">{stats.yesterdayAbsences}</p>
            </div>
            <AlertCircle size={24} className="text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Aktywnych uczniów</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeStudents}</p>
            </div>
            <Users size={24} className="text-green-400" />
          </div>
        </div>
        </div>
      </div>

      {/* Today's lessons */}
      {stats.todayLessons.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
            <span className="text-sm font-semibold text-blue-700">Dzisiejsze zajęcia</span>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.todayLessons.map(lesson => {
              const startTime = new Date(`2000-01-01T${lesson.start_time}`)
              const now = new Date()
              const lessonDate = new Date(lesson.date)
              const minutesUntil = Math.round(
                (new Date(
                  lessonDate.getFullYear(),
                  lessonDate.getMonth(),
                  lessonDate.getDate(),
                  startTime.getHours(),
                  startTime.getMinutes()
                ).getTime() - now.getTime()) / 60000
              )

              return (
                <div key={lesson.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {lesson.start_time.slice(0, 5)} — {lesson.end_time.slice(0, 5)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {lesson.is_group ? '👥 Grupa' : '👤'} {lesson.students?.name}
                        {lesson.tutors && ` — ${lesson.tutors.name}`}
                      </p>
                      {lesson.room && <p className="text-xs text-gray-500">{lesson.room}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {minutesUntil > 0 ? `za ${minutesUntil} min` : 'Teraz'}
                      </p>
                      {lesson.amount_due && (
                        <p className="text-xs text-gray-500">{lesson.amount_due} zł</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending payments */}
      {stats.pendingPayments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <span className="text-sm font-semibold text-red-700">
              Zaległe płatności ({stats.pendingPayments.length})
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.pendingPayments.map(payment => (
              <div key={payment.student_id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{payment.name}</p>
                </div>
                <p className="font-bold text-red-600">{payment.balance} zł</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.todayLessons.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Dzisiaj brak zaplanowanych zajęć</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-sm transition' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        {icon}
        {onClick && <span className="text-[10px] text-gray-300 font-medium">szczegóły ›</span>}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
