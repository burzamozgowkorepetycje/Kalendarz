import { NextRequest, NextResponse } from 'next/server'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'
import { isTutorConnected, isGoogleCalendarConfigured } from '@/lib/googleCalendar'

export async function GET(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connected = await isTutorConnected(tutor.tutorId)
  return NextResponse.json({ connected, configured: isGoogleCalendarConfigured() })
}
