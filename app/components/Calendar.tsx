'use client'

import { useState, useEffect } from 'react'
import { Lesson as TimeSlot } from '@/lib/types'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface CalendarProps {
  slots: TimeSlot[]
  onBookSlot: (slotId: string, studentName: string) => void
  loading?: boolean
}

export function Calendar({ slots, onBookSlot, loading }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [studentName, setStudentName] = useState('')
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())

  const monthSlots = slots.filter((slot) => {
    const slotDate = new Date(slot.date)
    return (
      slotDate.getMonth() === currentMonth.getMonth() &&
      slotDate.getFullYear() === currentMonth.getFullYear()
    )
  })

  const groupedByDate = monthSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = []
      acc[slot.date].push(slot)
      return acc
    },
    {} as Record<string, TimeSlot[]>
  )

  const handleBook = async (slot: TimeSlot) => {
    if (!studentName.trim()) {
      alert('Proszę wpisać imię ucznia')
      return
    }

    setSelectedSlot(slot)
    const link = new URLSearchParams(window.location.search).get('link')

    try {
      const response = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: slot.id, studentName, link }),
      })

      if (response.ok) {
        setBookedSlots(new Set([...bookedSlots, slot.id]))
        setStudentName('')
        setSelectedSlot(null)
        alert('Rezerwacja potwierdzna!')
      }
    } catch (error) {
      alert('Błąd rezerwacji')
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold">
          {currentMonth.toLocaleDateString('pl-PL', {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Slots Grid */}
      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, dateSlots]) => (
          <div key={date} className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-lg mb-3">
              {new Date(date).toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dateSlots.map((slot) => (
                <div key={slot.id}>
                  <button
                    disabled={bookedSlots.has(slot.id) || loading}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full p-3 rounded-lg font-semibold transition ${
                      bookedSlots.has(slot.id)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{slot.start_time}</span>
                      {bookedSlots.has(slot.id) && <Check size={16} />}
                    </div>
                    <div className="text-xs opacity-75">{slot.duration_minutes} min</div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-xl font-bold mb-4">Potwierdź rezerwację</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Data i godzina
                </label>
                <p className="text-gray-700">
                  {selectedSlot.date} {selectedSlot.start_time}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Czas trwania
                </label>
                <p className="text-gray-700">{selectedSlot.duration_minutes} minut</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Imię ucznia
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Wpisz imię"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSlot(null)
                    setStudentName('')
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleBook(selectedSlot)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Zarezerwuj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
