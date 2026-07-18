import { NextRequest, NextResponse } from 'next/server'
import { verifyTutorToken } from '@/app/api/tutor/auth/route'
import { disconnectTutor } from '@/lib/googleCalendar'

/** Rozłącza konto Google. Nie usuwa istniejących wydarzeń w kalendarzu — po prostu
 * przestajemy je od teraz aktualizować/usuwać (najprostsze bezpieczne zachowanie). */
export async function POST(req: NextRequest) {
  const tutor = verifyTutorToken(req)
  if (!tutor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await disconnectTutor(tutor.tutorId)
  return NextResponse.json({ success: true })
}
