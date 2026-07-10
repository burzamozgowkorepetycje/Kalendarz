'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookOpen, Settings } from 'lucide-react'

function TutorEntryContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const link = searchParams.get('link')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tutorName, setTutorName] = useState<string | null>(null)

  useEffect(() => {
    if (!link) {
      setError('Brakuje linku dostępu')
      return
    }

    const checkLink = async () => {
      const res = await fetch(`/api/tutor/auth?link=${encodeURIComponent(link)}`)
      if (res.ok) {
        const data = await res.json()
        setTutorName(data.name)
      } else {
        setError('Nieprawidłowy link dostępu')
      }
    }

    checkLink()
  }, [link])

  const goToDashboard = () => {
    if (!link) return
    setLoading(true)
    localStorage.setItem('tutor_link', link)
    router.push(`/tutor/dashboard?link=${link}`)
  }

  const goToAdmin = async () => {
    if (!link) return
    setLoading(true)
    const res = await fetch(`/api/tutor/auth?link=${encodeURIComponent(link)}&admin=true`)
    if (res.ok) {
      localStorage.setItem('admin_link', link)
      router.push(`/admin?link=${link}`)
    } else {
      setError('Brak dostępu do panelu admina')
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Błąd dostępu</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Wróć na stronę główną
          </a>
        </div>
      </div>
    )
  }

  if (!tutorName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
          <p className="text-gray-500">Ładowanie...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Cześć, {tutorName}! 👋</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Gdzie chcesz się zalogować?</p>
        <div className="space-y-3">
          <button
            onClick={goToDashboard}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50"
          >
            <BookOpen size={20} />
            {loading ? 'Ładowanie...' : 'Panel korepetytora'}
          </button>
          <button
            onClick={goToAdmin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition disabled:opacity-50"
          >
            <Settings size={20} />
            {loading ? 'Ładowanie...' : 'Panel admina'}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">Lub wróć na <a href="/" className="text-blue-600 hover:underline">stronę główną</a></p>
      </div>
    </div>
  )
}

export default function TutorEntry() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
            <p className="text-gray-500">Ładowanie...</p>
          </div>
        </div>
      }
    >
      <TutorEntryContent />
    </Suspense>
  )
}
