'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar } from '@/app/components/Calendar'
import { Lesson as TimeSlot } from '@/lib/types'

interface TutorInfo {
  id: string
  name: string
  email: string
}

export default function BookingContent() {
  const searchParams = useSearchParams()
  const link = searchParams.get('link')

  const [tutorInfo, setTutorInfo] = useState<TutorInfo | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!link) {
      setError('Brakuje linku dostępu')
      setLoading(false)
      return
    }

    const fetchSlots = async () => {
      try {
        const response = await fetch(`/api/slots?link=${link}`)
        if (response.ok) {
          const data = await response.json()
          setTutorInfo(data.tutor)
          setSlots(data.slots)
        } else {
          setError('Nieznany link dostępu')
        }
      } catch (err) {
        setError('Błąd ładowania danych')
      } finally {
        setLoading(false)
      }
    }

    fetchSlots()
  }, [link])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Ładowanie...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Błąd</h1>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto">
        {tutorInfo && (
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-2">{tutorInfo.name}</h1>
            <p className="text-gray-600">Zarezerwuj swoją lekcję korepetycji</p>
          </div>
        )}

        <Calendar slots={slots} onBookSlot={() => {}} loading={loading} />
      </div>
    </main>
  )
}
