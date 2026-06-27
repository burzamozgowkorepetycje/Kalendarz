'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import TutorsTab from './tabs/TutorsTab'
import StudentsTab from './tabs/StudentsTab'
import AttendanceTab from './tabs/AttendanceTab'
import ReportsTab from './tabs/ReportsTab'
import CalendarTab from './tabs/CalendarTab'
import PaymentsTab from './tabs/PaymentsTab'
import HistoryTab from './tabs/HistoryTab'
import AttendanceReviewTab from './tabs/AttendanceReviewTab'

const TABS = [
  { id: 'calendar', label: 'Kalendarz' },
  { id: 'tutors', label: 'Korepetytorzy' },
  { id: 'students', label: 'Uczniowie' },
  { id: 'payments', label: 'Płatności' },
  { id: 'attendance', label: 'Obecność' },
  { id: 'review', label: 'Do sprawdzenia' },
  { id: 'reports', label: 'Raporty' },
  { id: 'history', label: 'Historia' },
]

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [activeTab, setActiveTab] = useState('calendar')
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const correct = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123'
    if (password === correct) {
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('Nieprawidłowe hasło')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Panel Admina</h1>
          <p className="text-gray-500 text-center mb-6 text-sm">System zarządzania korepetycjami</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasło</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Wpisz hasło"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg sm:text-xl font-bold text-blue-600">Panel Admina</h1>
        <button
          onClick={() => { setIsAuthenticated(false); setPassword('') }}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Wyloguj
        </button>
      </header>

      {/* Tabs — przewijane w poziomie na telefonie */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-4 sm:gap-6 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {activeTab === 'calendar' && <CalendarTab password={password} />}
        {activeTab === 'tutors' && <TutorsTab password={password} />}
        {activeTab === 'students' && <StudentsTab password={password} />}
        {activeTab === 'payments' && <PaymentsTab password={password} />}
        {activeTab === 'attendance' && <AttendanceTab password={password} />}
        {activeTab === 'review' && <AttendanceReviewTab password={password} />}
        {activeTab === 'reports' && <ReportsTab password={password} />}
        {activeTab === 'history' && <HistoryTab password={password} />}
      </main>
    </div>
  )
}
