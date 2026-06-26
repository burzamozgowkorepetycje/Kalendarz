'use client'

import { useState } from 'react'
import { BarChart2, DollarSign, Send } from 'lucide-react'

interface TutorReport {
  tutor_id: string
  name: string
  hours: number
  earned: number
}

interface PaymentReport {
  student_id: string
  name: string
  email: string | null
  phone: string | null
  total_due: number
  total_paid: number
  balance: number
}

export default function ReportsTab({ password }: { password: string }) {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 7) + '-01'

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)
  const [tutorReport, setTutorReport] = useState<TutorReport[]>([])
  const [paymentReport, setPaymentReport] = useState<PaymentReport[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` }

  const loadReports = async () => {
    setLoading(true)
    const [tutorRes, payRes] = await Promise.all([
      fetch(`/api/admin/reports?type=tutor-hours&from=${from}&to=${to}`, { headers }),
      fetch(`/api/admin/reports?type=payments&from=${from}&to=${to}`, { headers }),
    ])
    if (tutorRes.ok) setTutorReport(await tutorRes.json())
    if (payRes.ok) setPaymentReport(await payRes.json())
    setLoading(false)
  }

  const sendPaymentReminder = async (student: PaymentReport) => {
    if (!student.email && !student.phone) {
      alert('Uczeń nie ma email ani telefonu')
      return
    }
    setSendingReminder(student.student_id)
    await fetch('/api/admin/send-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ student_id: student.student_id, amount: student.balance }),
    })
    setSendingReminder(null)
    alert(`Przypomnienie wysłane do ${student.name}`)
  }

  const totalHours = tutorReport.reduce((s, t) => s + t.hours, 0)
  const totalUnpaid = paymentReport.reduce((s, p) => s + p.balance, 0)

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
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
          <button onClick={loadReports} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Ładowanie...' : 'Generuj raport'}
          </button>
        </div>
      </div>

      {tutorReport.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-1">
                <BarChart2 size={20} className="text-blue-500" />
                <span className="text-sm text-gray-500">Łącznie godzin</span>
              </div>
              <p className="text-3xl font-bold">{totalHours.toFixed(1)} h</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-1">
                <DollarSign size={20} className="text-red-500" />
                <span className="text-sm text-gray-500">Do zebrania</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{totalUnpaid} zł</p>
            </div>
          </div>

          {/* Tutor hours */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Godziny korepetytorów</span>
            </div>
            <div className="divide-y divide-gray-100">
              {tutorReport.map(t => (
                <div key={t.tutor_id} className="px-6 py-4 flex justify-between items-center">
                  <p className="font-medium">{t.name}</p>
                  <div className="text-right">
                    <p className="font-semibold">{t.hours} h</p>
                    <p className="text-sm text-gray-500">{t.earned} zł</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-600">Płatności uczniów</span>
            </div>
            <div className="divide-y divide-gray-100">
              {paymentReport.map(p => (
                <div key={p.student_id} className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-gray-500">
                      Zapłacone: {p.total_paid} zł / {p.total_due} zł
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`font-semibold ${p.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {p.balance > 0 ? `−${p.balance} zł` : 'Rozliczony'}
                      </p>
                    </div>
                    {p.balance > 0 && (
                      <button
                        onClick={() => sendPaymentReminder(p)}
                        disabled={sendingReminder === p.student_id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm hover:bg-orange-100 disabled:opacity-50">
                        <Send size={14} />
                        {sendingReminder === p.student_id ? 'Wysyłanie...' : 'Przypomnij'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tutorReport.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">Wybierz zakres dat i kliknij „Generuj raport"</p>
        </div>
      )}
    </div>
  )
}
