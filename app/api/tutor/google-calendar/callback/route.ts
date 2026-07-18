import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { exchangeCodeForTokens } from '@/lib/googleCalendar'

const JWT_SECRET = process.env.JWT_SECRET || 'tutor-secret-key-change-in-production'

/** Callback wywoływany przez Google po zgodzie użytkownika. Wymienia kod na tokeny i zapisuje je. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const redirectBase = new URL('/tutor/dashboard', req.url)

  if (error) {
    redirectBase.searchParams.set('google_calendar', 'denied')
    return NextResponse.redirect(redirectBase)
  }

  if (!code || !state) {
    redirectBase.searchParams.set('google_calendar', 'error')
    return NextResponse.redirect(redirectBase)
  }

  let tutorId: string
  try {
    const payload = jwt.verify(state, JWT_SECRET) as { tutorId: string }
    tutorId = payload.tutorId
  } catch {
    redirectBase.searchParams.set('google_calendar', 'error')
    return NextResponse.redirect(redirectBase)
  }

  try {
    await exchangeCodeForTokens(tutorId, code)
    redirectBase.searchParams.set('google_calendar', 'connected')
  } catch (err) {
    console.error('[google-calendar/callback] token exchange failed:', err)
    redirectBase.searchParams.set('google_calendar', 'error')
  }

  return NextResponse.redirect(redirectBase)
}
