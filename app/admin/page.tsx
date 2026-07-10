'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Search, User, GraduationCap } from 'lucide-react'
import DashboardTab from './tabs/DashboardTab'
import TutorsTab from './tabs/TutorsTab'
import StudentsTab from './tabs/StudentsTab'
import AttendanceTab from './tabs/AttendanceTab'
import ReportsTab from './tabs/ReportsTab'
import CalendarTab from './tabs/CalendarTab'
import PaymentsTab from './tabs/PaymentsTab'
import HistoryTab from './tabs/HistoryTab'
import AttendanceReviewTab from './tabs/AttendanceReviewTab'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
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
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState<{ students: { id: string; name: string; phone: string | null }[]; tutors: { id: string; name: string; phone: string | null }[] }>({ students: [], tutors: [] })
  const [searchOpen, setSearchOpen] = useState(false)
  const [focusStudentId, setFocusStudentId] = useState<string | null>(null)

  useEffect(() => {
    if (searchQ.trim().length < 2) { setResults({ students: [], tutors: [] }); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQ)}`, {
        headers: { Authorization: `Bearer ${password}` },
      })
      if (res.ok) setResults(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [searchQ, password])

  const goToStudent = (id: string) => {
    setFocusStudentId(id)
    setActiveTab('students')
    setSearchQ(''); setSearchOpen(false)
  }
  const goToTutor = () => {
    setActiveTab('tutors')
    setSearchQ(''); setSearchOpen(false)
  }

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
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg sm:text-xl font-bold text-blue-600 shrink-0">Panel Admina</h1>

        {/* Wyszukiwarka globalna */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Szukaj: uczeń, telefon, korepetytor..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {searchOpen && searchQ.trim().length >= 2 && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSearchOpen(false)} />
              <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {results.students.length === 0 && results.tutors.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400 text-center">Brak wyników</p>
                ) : (
                  <>
                    {results.students.length > 0 && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Uczniowie</p>
                        {results.students.map(s => (
                          <button key={s.id} onClick={() => goToStudent(s.id)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                            <User size={14} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-900">{s.name}</span>
                            {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {results.tutors.length > 0 && (
                      <div>
                        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Korepetytorzy</p>
                        {results.tutors.map(t => (
                          <button key={t.id} onClick={goToTutor}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                            <GraduationCap size={14} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-900">{t.name}</span>
                            {t.phone && <span className="text-xs text-gray-400">{t.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => { setIsAuthenticated(false); setPassword('') }}
          className="text-sm text-gray-500 hover:text-red-600 shrink-0"
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
        {activeTab === 'dashboard' && <DashboardTab password={password} />}
        {activeTab === 'calendar' && <CalendarTab password={password} />}
        {activeTab === 'tutors' && <TutorsTab password={password} />}
        {activeTab === 'students' && <StudentsTab password={password} focusStudentId={focusStudentId} />}
        {activeTab === 'payments' && <PaymentsTab password={password} />}
        {activeTab === 'attendance' && <AttendanceTab password={password} />}
        {activeTab === 'review' && <AttendanceReviewTab password={password} />}
        {activeTab === 'reports' && <ReportsTab password={password} />}
        {activeTab === 'history' && <HistoryTab password={password} />}
      </main>
    </div>
  )
}
