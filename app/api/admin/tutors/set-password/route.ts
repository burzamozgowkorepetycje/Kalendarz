import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { hasFinancialAccess } from '@/lib/auth'


export async function POST(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { tutor_id, login, password } = await req.json()

    if (!tutor_id || !login || !password) {
      return NextResponse.json({ error: 'Brak wymaganych pól' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Hasło musi mieć co najmniej 6 znaków' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const { error } = await supabaseAdmin
      .from('tutors')
      .update({ login, password_hash })
      .eq('id', tutor_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}
