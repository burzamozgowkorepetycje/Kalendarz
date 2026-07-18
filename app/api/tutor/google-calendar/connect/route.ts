import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from '@/lib/googleCalendar'

const JWT_SECRET = process.env.JWT_SECRET || 'tutor-secret-key-change-in-production'

/** Rozpoczyna flow OAuth: przekierowuje korepetytora na ekran zgody Google. */
export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: 'Synchronizacja z Google Calendar nie jest jeszcze skonfigurowana (brak GOOGLE_CLIENT_ID/SECRET w środowisku).' },
      { status: 503 }
    )
  }

  // Podpisany, krótkożyjący state, żeby callback mógł bezpiecznie zweryfikować, dla
  // którego korepetytora jest ten kod autoryzacyjny (Google zwraca state bez zmian).
  const state = jwt.sign({ tutorId: tutor.tutorId }, JWT_SECRET, { expiresIn: '10m' })

  return NextResponse.redirect(getGoogleAuthUrl(state))
}
