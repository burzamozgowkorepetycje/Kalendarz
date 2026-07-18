import { NextRequest, NextResponse } from 'next/server'
import { getStaffRole } from '@/lib/auth'

// Zwraca rolę zalogowanego pracownika na podstawie hasła (Bearer token).
// Używane przez panel admina do dopasowania widocznych zakładek do roli.
export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ role })
}
