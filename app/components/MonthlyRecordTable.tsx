'use client'

import { Download, Printer } from 'lucide-react'

export interface DayRecord {
  date: string
  minutes: number
  hours: number
  lessonsCount: number
  baseAmount: number
  adjustment: number
  adjustmentNote: string | null
  amount: number
  runningTotal: number
}

export interface MonthlyRecordSummary {
  totalMinutes: number
  totalHours: number
  totalLessons: number
  totalBaseAmount: number
  totalAdjustments: number
  totalAmount: number
}

export interface MonthlyApproval {
  approved: boolean
  approved_at: string | null
}

export interface MonthlyRecordData {
  tutor_id: string
  tutor_name: string
  month: string
  days: DayRecord[]
  summary: MonthlyRecordSummary
  approval: MonthlyApproval
}

function plDate(s: string) { return new Date(s + 'T00:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmt(n: number) { return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł' }
function fmtH(n: number) { return n.toFixed(2).replace('.', ',') + ' h' }

export function exportMonthlyRecordCSV(data: MonthlyRecordData) {
  const rows: string[] = []
  rows.push(`Ewidencja pracy i wynagrodzenia — ${data.tutor_name} — ${data.month}`)
  rows.push('')
  rows.push('Data;Godziny;Liczba zajęć;Kwota bazowa (zł);Korekta (zł);Notatka korekty;Kwota razem (zł);Suma narastająco (zł)')
  for (const d of data.days) {
    rows.push([
      plDate(d.date), d.hours.toFixed(2).replace('.', ','), d.lessonsCount,
      d.baseAmount.toFixed(2).replace('.', ','), d.adjustment.toFixed(2).replace('.', ','),
      (d.adjustmentNote || '').replace(/;/g, ','), d.amount.toFixed(2).replace('.', ','),
      d.runningTotal.toFixed(2).replace('.', ','),
    ].join(';'))
  }
  rows.push('')
  rows.push('PODSUMOWANIE MIESIĄCA')
  rows.push('Godziny;Liczba zajęć;Kwota bazowa;Korekty;Razem do wypłaty')
  rows.push([
    data.summary.totalHours.toFixed(2).replace('.', ','), data.summary.totalLessons,
    data.summary.totalBaseAmount.toFixed(2).replace('.', ','), data.summary.totalAdjustments.toFixed(2).replace('.', ','),
    data.summary.totalAmount.toFixed(2).replace('.', ','),
  ].join(';'))
  rows.push('')
  rows.push(`Zatwierdzone przez korepetytora: ${data.approval.approved ? `TAK (${data.approval.approved_at ? new Date(data.approval.approved_at).toLocaleString('pl-PL') : ''})` : 'NIE'}`)

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ewidencja_${data.tutor_name.replace(/\s+/g, '_')}_${data.month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Widok tabelaryczny ewidencji miesiecznej — uzywany zarowno przez widok korepetytora,
// jak i widok admina. Layout jest celowo prosty (data / godziny / liczba zajec / kwota /
// suma narastajaco), poniewaz nie ma ustalonego wymogu formatu dla ksiegowej.
export default function MonthlyRecordTable({ data, extraActions }: { data: MonthlyRecordData; extraActions?: React.ReactNode }) {
  return (
    <div id="monthly-record-print-area">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div className="flex gap-2">
          <button onClick={() => exportMonthlyRecordCSV(data)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Download size={15} /> Eksport CSV / Excel
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Printer size={15} /> Drukuj / PDF
          </button>
        </div>
        {extraActions}
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Ewidencja pracy i wynagrodzenia korepetytora</h1>
        <p className="text-sm text-gray-600">{data.tutor_name} — {data.month}</p>
        <p className="text-sm text-gray-600">
          Zatwierdzone przez korepetytora: {data.approval.approved ? `TAK, ${data.approval.approved_at ? new Date(data.approval.approved_at).toLocaleString('pl-PL') : ''}` : 'NIE'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 print:hidden">
        <SummaryTile label="Godziny" value={fmtH(data.summary.totalHours)} />
        <SummaryTile label="Zajęcia" value={String(data.summary.totalLessons)} />
        <SummaryTile label="Korekty" value={fmt(data.summary.totalAdjustments)} />
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <p className="text-xs text-blue-100 mb-1">Razem do wypłaty</p>
          <p className="text-2xl font-bold">{fmt(data.summary.totalAmount)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-semibold">Data</th>
                <th className="px-4 py-2 text-right font-semibold">Godziny</th>
                <th className="px-4 py-2 text-right font-semibold">Zajęcia</th>
                <th className="px-4 py-2 text-right font-semibold">Kwota bazowa</th>
                <th className="px-4 py-2 text-right font-semibold">Korekta</th>
                <th className="px-4 py-2 text-left font-semibold">Notatka</th>
                <th className="px-4 py-2 text-right font-semibold">Kwota dnia</th>
                <th className="px-4 py-2 text-right font-semibold">Suma narastająco</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map(d => (
                <tr key={d.date} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{plDate(d.date)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmtH(d.hours)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{d.lessonsCount}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmt(d.baseAmount)}</td>
                  <td className={`px-4 py-2 text-right ${d.adjustment !== 0 ? (d.adjustment > 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-300'}`}>
                    {d.adjustment !== 0 ? fmt(d.adjustment) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 max-w-[220px] truncate">{d.adjustmentNote || ''}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{fmt(d.amount)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{fmt(d.runningTotal)}</td>
                </tr>
              ))}
              {data.days.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Brak zajęć w tym miesiącu</td></tr>
              )}
            </tbody>
            {data.days.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                  <td className="px-4 py-2 text-gray-700">Razem</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmtH(data.summary.totalHours)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{data.summary.totalLessons}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmt(data.summary.totalBaseAmount)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmt(data.summary.totalAdjustments)}</td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2 text-right text-gray-900">{fmt(data.summary.totalAmount)}</td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
