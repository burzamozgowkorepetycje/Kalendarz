'use client'

import { Suspense } from 'react'
import BookingContent from './BookingContent'

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-lg">Ładowanie...</p>
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  )
}
