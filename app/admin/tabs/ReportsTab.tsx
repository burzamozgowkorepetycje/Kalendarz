'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Clock, Send, Lock, Download, Printer } from 'lucide-react'

interface Summary { revenue: number; cost: number; profit: number }
interface TutorRow { tutor_id: string; name: string; hours: number; revenue: number; cost: number; profit: number }
interface TypeRow { type: string; revenue: number; cost: number; profit: number }
interface SubjectRow { subject: string; revenue: number; cost: number; profit: number }
interface StudentRow { student_id: string; name: string; email: string | null; phone: string | null; total_due: number; total_paid: number; balance: number }

interface ReportData {
  summary: Summary
  tutors: TutorRow[]
  byType: TypeRow[]
  bySubject: SubjectRow[]
  students: StudentRow[]
}

const REPORTS_PASSWORD = process.env.NEXT_PUBLIC_REPORTS_PASSWORD || 'admin1234'

function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł' }
function fmtH(n: number) { return n.toFixed(1) + ' h' }

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function MoneyRow({ label, revenue, cost, profit }: { label: string; revenue: number; cost: number; profit: number }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-6 py-3 text-sm font-medium text-gray-900">{label}</td>
      <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(revenue)}</td>
      <td className="px-6 py-3 text-sm text-right text-red-600">{fmt(cost)}</td>
      <td className={`px-6 py-3 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(profit)}</td>
    </tr>
  )
}

function exportCSV(data: ReportData, from: string, to: string) {
  const rows: string[] = []
  rows.push(`Raport finansowy ${from} – ${to}`)
  rows.push('')

  rows.push('PODSUMOWANIE')
  rows.push('Przychód;Koszt;Zysk')
  rows.push(`${data.summary.revenue};${data.summary.cost};${data.summary.profit}`)
  rows.push('')

  rows.push('KOREPETYTORZY')
  rows.push('Imię i nazwisko;Godziny;Przychód (zł);Koszt (zł);Zysk (zł)')
  data.tutors.forEach(t => rows.push(`${t.name};${t.hours};${t.revenue};${t.cost};${t.profit}`))
  rows.push('')

  rows.push('RODZAJ ZAJĘĆ')
  rows.push('Rodzaj;Przychód (zł);Koszt (zł);Zysk (zł)')
  data.byType.forEach(r => rows.push(`${r.type};${r.revenue};${r.cost};${r.profit}`))
  rows.push('')

  rows.push('PRZEDMIOTY')
  rows.push('Przedmiot;Przychód (zł);Koszt (zł);Zysk (zł)')
  data.bySubject.forEach(r => rows.push(`${r.subject};${r.revenue};${r.cost};${r.profit}`))
  rows.push('')

  rows.push('UCZNIOWIE')
  rows.push('Uczeń;Do zapłaty (zł);Zapłacono (zł);Zaległość (zł)')
  data.students.forEach(s => rows.push(`${s.name};${s.total_due};${s.total_paid};${s.balance}`))

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `raport_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsTab({ password }: { password: string }) {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [unlocked, setUnlocked] = useState(false)
  const [reportsPwd, setReportsPwd] = useState('')
  const [pwdError, setPwdError] = useState(false)

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)
  const [paidOnly, setPaidOnly] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (reportsPwd === REPORTS_PASSWORD) {
      setUnlocked(true)
      setPwdError(false)
    } else {
      setPwdError(true)
    }
  }

  const loadReport = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/reports?from=${from}&to=${to}&paid_only=${paidOnly}`, { headers })
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  const sendReminder = async (student: StudentRow) => {
    if (!student.email && !student.phone) { alert('Uczeń nie ma email ani telefonu'); return }
    setSendingReminder(student.student_id)
    const res = await fetch('/api/admin/send-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ student_id: student.student_id, amount: student.balance }),
    })
    setSendingReminder(null)
    if (res.ok) {
      alert(`Przypomnienie wysłane do ${student.name}`)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(`Nie udało się wysłać: ${data.error || 'błąd serwera'}`)
    }
  }

  // Password gate
  if (!unlocked) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={20} className="text-gray-700" />
            <h2 className="text-lg font-bold text-gray-900">Raporty — dostęp zastrzeżony</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">Podaj hasło właściciela, aby wyświetlić raporty finansowe.</p>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              required
              autoFocus
              value={reportsPwd}
              onChange={e => { setReportsPwd(e.target.value); setPwdError(false) }}
              placeholder="Hasło do raportów"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 ${pwdError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {pwdError && <p className="text-sm text-red-600">Nieprawidłowe hasło</p>}
            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700">
              Odblokuj
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" id="report-print-area">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Od</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Do</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-1">
          <input type="checkbox" checked={paidOnly} onChange={e => setPaidOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          Tylko opłacone
        </label>
        <button onClick={loadReport} disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Ładowanie...' : 'Generuj raport'}
        </button>
        {data && (
          <div className="flex gap-2 ml-auto">
            <button onClick={() => exportCSV(data, from, to)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Download size={15} /> Eksport CSV
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Printer size={15} /> Drukuj / PDF
            </button>
          </div>
        )}
      </div>

      {!data && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-14 text-center">
          <p className="text-gray-400 text-sm">Wybierz zakres dat i kliknij „Generuj raport"</p>
        </div>
      )}

      {data && (
        <>
          {/* Print header */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold">Raport finansowy</h1>
            <p className="text-sm text-gray-500">{from} – {to} {paidOnly ? '(tylko opłacone)' : '(wszystkie)'}</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Przychód" value={fmt(data.summary.revenue)} color="text-blue-600" icon={<DollarSign size={20} />} />
            <SummaryCard label="Koszty (wypłaty)" value={fmt(data.summary.cost)} color="text-red-500" icon={<TrendingDown size={20} />} />
            <SummaryCard label="Zysk" value={fmt(data.summary.profit)} color={data.summary.profit >= 0 ? 'text-green-600' : 'text-red-600'} icon={<TrendingUp size={20} />} />
          </div>

          {/* Per tutor */}
          <TableSection title="Korepetytorzy">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-2 text-left font-semibold">Korepetytor</th>
                  <th className="px-6 py-2 text-right font-semibold">Godziny</th>
                  <th className="px-6 py-2 text-right font-semibold">Przychód</th>
                  <th className="px-6 py-2 text-right font-semibold">Wypłata</th>
                  <th className="px-6 py-2 text-right font-semibold">Zysk</th>
                </tr>
              </thead>
              <tbody>
                {data.tutors.map(t => (
                  <tr key={t.tutor_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-600">{fmtH(t.hours)}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(t.revenue)}</td>
                    <td className="px-6 py-3 text-sm text-right text-red-600">{fmt(t.cost)}</td>
                    <td className={`px-6 py-3 text-sm text-right font-semibold ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(t.profit)}</td>
                  </tr>
                ))}
                {data.tutors.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-400">Brak danych</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>

          {/* Per lesson type */}
          <TableSection title="Rodzaj zajęć">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-2 text-left font-semibold">Rodzaj</th>
                  <th className="px-6 py-2 text-right font-semibold">Przychód</th>
                  <th className="px-6 py-2 text-right font-semibold">Koszt</th>
                  <th className="px-6 py-2 text-right font-semibold">Zysk</th>
                </tr>
              </thead>
              <tbody>
                {data.byType.map(r => <MoneyRow key={r.type} label={r.type} revenue={r.revenue} cost={r.cost} profit={r.profit} />)}
                {data.byType.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-400">Brak danych</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>

          {/* Per subject */}
          <TableSection title="Przedmioty">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-2 text-left font-semibold">Przedmiot</th>
                  <th className="px-6 py-2 text-right font-semibold">Przychód</th>
                  <th className="px-6 py-2 text-right font-semibold">Koszt</th>
                  <th className="px-6 py-2 text-right font-semibold">Zysk</th>
                </tr>
              </thead>
              <tbody>
                {data.bySubject.map(r => <MoneyRow key={r.subject} label={r.subject} revenue={r.revenue} cost={r.cost} profit={r.profit} />)}
                {data.bySubject.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-400">Brak danych</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>

          {/* Per student */}
          <TableSection title="Uczniowie — rozliczenia">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <th className="px-6 py-2 text-left font-semibold">Uczeń</th>
                  <th className="px-6 py-2 text-right font-semibold">Do zapłaty</th>
                  <th className="px-6 py-2 text-right font-semibold">Zapłacono</th>
                  <th className="px-6 py-2 text-right font-semibold">Zaległość</th>
                  <th className="px-6 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => (
                  <tr key={s.student_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-700">{fmt(s.total_due)}</td>
                    <td className="px-6 py-3 text-sm text-right text-green-600">{fmt(s.total_paid)}</td>
                    <td className={`px-6 py-3 text-sm text-right font-semibold ${s.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {s.balance > 0 ? fmt(s.balance) : '—'}
                    </td>
                    <td className="px-6 py-3 print:hidden">
                      {s.balance > 0 && (
                        <button onClick={() => sendReminder(s)} disabled={sendingReminder === s.student_id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs hover:bg-orange-100 disabled:opacity-50">
                          <Send size={12} />
                          {sendingReminder === s.student_id ? 'Wysyłanie...' : 'Przypomnij'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.students.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-400">Brak danych</td></tr>
                )}
              </tbody>
            </table>
          </TableSection>
        </>
      )}
    </div>
  )
}
