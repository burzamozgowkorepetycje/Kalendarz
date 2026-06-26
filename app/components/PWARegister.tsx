'use client'

import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // rejestracja SW nieobowiązkowa — ignorujemy błędy
      })
    }
  }, [])

  return null
}
