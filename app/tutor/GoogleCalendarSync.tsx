'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck } from 'lucide-react'

/**
 * Przycisk "Połącz z Google Calendar" / "Rozłącz" dla korepetytora.
 *
 * Jednokierunkowa synchronizacja: po połączeniu system tworzy/aktualizuje/usuwa
 * wydarzenia w kalendarzu korepetytora dla jego zajęć. Prywatne wydarzenia
 * korepetytora nigdy nie są odczytywane.
 */
export default function GoogleCalendarSync() {
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    fetch('/api/tutor/google-calendar/status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          setConnected(Boolean(d.connected))
          setConfigured(Boolean(d.configured))
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // Po powrocie z ekranu zgody Google (?google_calendar=connected|error|denied) odśwież status.
    const params = new URLSearchParams(window.location.search)
    if (params.has('google_calendar')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('google_calendar')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleDisconnect = async () => {
    if (!confirm('Rozłączyć Google Calendar? Istniejące wydarzenia w kalendarzu zostaną — po prostu przestaną się aktualizować.')) return
    setLoading(true)
    await fetch('/api/tutor/google-calendar/disconnect', { method: 'POST' })
    refresh()
  }

  if (loading) return null

  if (!configured) {
    // Szkielet działa, ale właściciel jeszcze nie wkleił prawdziwych danych OAuth z Google Cloud Console.
    return (
      <span className="flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed" title="Synchronizacja z Google Calendar nie jest jeszcze skonfigurowana">
        <CalendarCheck size={16} /> Google Calendar (wkrótce)
      </span>
    )
  }

  if (connected) {
    return (
      <button onClick={handleDisconnect} className="flex items-center gap-1.5 text-sm text-green-700 hover:text-red-600 font-medium">
        <CalendarCheck size={16} /> Google Calendar: połączony (Rozłącz)
      </button>
    )
  }

  return (
    <a href="/api/tutor/google-calendar/connect" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
      <CalendarCheck size={16} /> Połącz z Google Calendar
    </a>
  )
}
