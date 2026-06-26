'use client'

import { useState } from 'react'
import { CheckCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'

interface PaymentRow {
  student_id: string
  name: string
  email: string | null
  phone: string | null
  total_due: number
  total_paid: number
  balance: number
}

export default function PaymentsTab({ password }: { password: string }) {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const loadData = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/reports?type=payments&from=${from}&to=${to}`, { headers })
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }

  const payAll = async (student_id: string) => {
    setPaying(student_id)
    await fetch('/api/admin/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify({ student_id }),
    })
    await loadData()
    setPaying(null)
  }

  const sendReminder = async (row: PaymentRow) => {
    setSending(row.student_id)
    await fetch('/api/admin/send-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ student_id: row.student_id, amount: row.balance }),
    })
    setSending(null)
    alert(`Przypomnienie wysłane do ${row.name}`)
  }

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const unpaidRows = rows.filter(r => r.balance > 0)
  const paidRows = rows.filter(r => r.balance <= 0)

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Od</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Ładowanie...' : 'Pokaż'}
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Łącznie do zebrania</p>
              <p className="text-2xl font-bold text-red-600">{totalBalance.toFixed(0)} zł</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Uczniowie z zaległościami</p>
              <p className="text-2xl font-bold text-gray-900">{unpaidRows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-1">Rozliczeni</p>
              <p className="text-2xl font-bold text-green-600">{paidRows.length}</p>
            </div>
          </div>

          {/* Unpaid */}
          {unpaidRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <span className="text-sm font-semibold text-red-700">Do zapłaty ({unpaidRows.length})</span>
              </div>
              <div className="divide-y divide-gray-100">
                {unpaidRows.map(row => (
                  <div key={row.student_id}>
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{row.name}</p>
                        <p className="text-sm text-gray-500">
                          Zapłacone: {row.total_paid} zł / {row.total_due} zł
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-red-600 text-lg">{row.balance} zł</p>
                        <button
                          onClick={() => setExpanded(expanded === row.student_id ? null : row.student_id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          {expanded === row.student_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <button onClick={() => sendReminder(row)} disabled={sending === row.student_id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm hover:bg-orange-100 disabled:opacity-50">
                          <Send size={14} />
                          {sending === row.student_id ? '...' : 'SMS'}
                        </button>
                        <button onClick={() => payAll(row.student_id)} disabled={paying === row.student_id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle size={14} />
                          {paying === row.student_id ? '...' : 'Opłać wszystko'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paid */}
          {paidRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-green-50 border-b border-green-100">
                <span className="text-sm font-semibold text-green-700">Rozliczeni ({paidRows.length})</span>
              </div>
              <div className="divide-y divide-gray-100">
                {paidRows.map(row => (
                  <div key={row.student_id} className="px-5 py-3 flex items-center justify-between">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm text-green-600 font-medium">{row.total_paid} zł</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {rows.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">Wybierz zakres dat i kliknij „Pokaż"</p>
        </div>
      )}
    </div>
  )
}
