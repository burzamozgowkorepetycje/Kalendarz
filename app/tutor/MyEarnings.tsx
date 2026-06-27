'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, X, AlertTriangle, Clock, BookOpen, User, Users, GraduationCap, Wallet } from 'lucide-react'

interface GroupStudent { attendance: string | null; students?: { name: string } | null }
interface EarnLesson {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  room: string | null
  subject: string | null
  lesson_type: string | null
  is_group: boolean
  attendance_status: 'present' | 'absent' | 'not_held' | null
  attendance_note: string | null
  tutor_amount: number | null
  students?: { name: string } | null
  lesson_students?: GroupStudent[]
}
interface Summary { hours: number; lessons: number; individual: number; group: number; course: number; total: number }

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); return x }
function plDate(s: string) { return new Date(s + 'T00:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

type Preset = 'today' | 'week' | 'month' | 'lastmonth' | 'custom'

export default function MyEarnings() {
  const today = new Date()
  const [preset, setPreset] = useState<Preset>('month')
  const [from, setFrom] = useState(fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to, setTo] = useState(fmtDate(today))
  const [lessons, setLessons] = useState<EarnLesson[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pendingAttendance, setPendingAttendance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<EarnLesson | null>(null)

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const now = new Date()
    if (p === 'today') { setFrom(fmtDate(now)); setTo(fmtDate(now)) }
    else if (p === 'week') { setFrom(fmtDate(startOfWeek(now))); setTo(fmtDate(now)) }
    else if (p === 'month') { setFrom(fmtDate(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(fmtDate(now)) }
    else if (p === 'lastmonth') {
      setFrom(fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
      setTo(fmtDate(new Date(now.getFullYear(), now.getMonth(), 0)))
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/tutor/earnings?from=${from}&to=${to}`)
    if (res.ok) {
      const data = await res.json()
      setLessons(data.lessons ?? [])
      setSummary(data.summary ?? null)
      setPendingAttendance(data.pendingAttendance ?? 0)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const typeLabel = (l: EarnLesson) =>
    l.lesson_type === 'Kursy maturalne' ? 'Kurs' : l.is_group ? 'Grupowe' : 'Indywidualne'

  const who = (l: EarnLesson) =>
    l.is_group ? ((l.lesson_students ?? []).map(s => s.students?.name).filter(Boolean).join(', ') || 'Grupa') : (l.students?.name || '—')

  const attendanceLabel = (l: EarnLesson) => {
    if (l.is_group) {
      const ls = l.lesson_students ?? []
      const present = ls.filter(s => s.attendance === 'present').length
      return ls.length ? `${present}/${ls.length} obecnych` : '—'
    }
    return l.attendance_status === 'present' ? 'Obecny'
      : l.attendance_status === 'absent' ? 'Nieobecny'
      : l.attendance_status === 'not_held' ? 'Do wyjaśnienia' : '—'
  }

  const exportCSV = () => {
    const rows: string[] = ['Data;Godzina;Czas (min);Przedmiot;Typ;Uczeń/Grupa;Wynagrodzenie (zł)']
    for (const l of lessons) {
      rows.push([plDate(l.date), String(l.start_time).substring(0, 5), l.duration_minutes,
        l.subject || '', typeLabel(l), who(l).replace(/;/g, ','), l.tutor_amount ?? 0].join(';'))
    }
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `moje_zarobki_${from}_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const PRESETS: [Preset, string][] = [['today', 'Dziś'], ['week', 'Ten tydzień'], ['month', 'Ten miesiąc'], ['lastmonth', 'Poprzedni miesiąc'], ['custom', 'Własny zakres']]

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Moje zarobki</h2>

      {pendingAttendance > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Masz nieuzupełnione obecności. Uzupełnij je, aby Twoje godziny i zarobki były poprawnie widoczne w podsumowaniu.</span>
        </div>
      )}

      {/* Filtry */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([p, label]) => (
          <button key={p} onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${preset === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
            {label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Od</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Do</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
          </div>
        </div>
      )}

      {/* Kafelki */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Tile icon={<Clock size={16} />} label="Godziny" value={`${summary.hours.toFixed(1).replace('.', ',')} h`} />
          <Tile icon={<BookOpen size={16} />} label="Lekcje" value={String(summary.lessons)} />
          <Tile icon={<User size={16} />} label="Indywidualne" value={String(summary.individual)} />
          <Tile icon={<Users size={16} />} label="Grupowe" value={String(summary.group)} />
          <Tile icon={<GraduationCap size={16} />} label="Kursy" value={String(summary.course)} />
          <div className="bg-blue-600 rounded-xl p-4 text-white">
            <div className="flex items-center gap-1.5 text-blue-100 text-xs mb-1"><Wallet size={16} /> Zarobki razem</div>
            <p className="text-2xl font-bold">{summary.total.toLocaleString('pl-PL')} zł</p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">Podsumowanie obejmuje lekcje przypisane do Twojego konta, które są wliczane do wynagrodzenia.</p>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Lekcje ({lessons.length})</span>
          {lessons.length > 0 && (
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              <Download size={14} /> Eksport CSV
            </button>
          )}
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Ładowanie...</p>
        ) : lessons.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">Brak lekcji w tym okresie</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Godz.</th>
                  <th className="px-3 py-2 text-left font-semibold">Czas</th>
                  <th className="px-3 py-2 text-left font-semibold">Przedmiot</th>
                  <th className="px-3 py-2 text-left font-semibold">Typ</th>
                  <th className="px-3 py-2 text-left font-semibold">Uczeń/grupa</th>
                  <th className="px-3 py-2 text-left font-semibold">Obecność</th>
                  <th className="px-3 py-2 text-right font-semibold">Wynagrodzenie</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map(l => (
                  <tr key={l.id} onClick={() => setDetail(l)} className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{plDate(l.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{String(l.start_time).substring(0, 5)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{l.duration_minutes} min</td>
                    <td className="px-3 py-2 text-gray-700">{l.subject || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{typeLabel(l)}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{who(l)}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{attendanceLabel(l)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{(l.tutor_amount ?? 0)} zł</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Szczegóły lekcji */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Szczegóły lekcji</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm">
              <Row label="Data" value={plDate(detail.date)} />
              <Row label="Godzina" value={`${String(detail.start_time).substring(0, 5)}–${String(detail.end_time).substring(0, 5)}`} />
              <Row label="Czas trwania" value={`${detail.duration_minutes} min`} />
              <Row label="Sala" value={detail.room || '—'} />
              <Row label="Przedmiot" value={detail.subject || '—'} />
              <Row label="Typ zajęć" value={typeLabel(detail)} />
              <Row label="Uczeń/grupa" value={who(detail)} />
              <Row label="Obecność" value={attendanceLabel(detail)} />
              {detail.attendance_note && <Row label="Notatka" value={detail.attendance_note} />}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-gray-600">Twoje wynagrodzenie</span>
                <span className="text-xl font-bold text-blue-600">{(detail.tutor_amount ?? 0)} zł</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">{icon} {label}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  )
}
