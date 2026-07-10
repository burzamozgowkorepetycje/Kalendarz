import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'tutor-secret-key-change-in-production'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const link = searchParams.get('link')

    if (!link) {
      return NextResponse.json({ error: 'Brakuje linku' }, { status: 400 })
    }

    const { data: tutor, error } = await supabaseAdmin
      .from('tutors')
      .select('id, name, unique_link, active')
      .eq('unique_link', link)
      .single()

    if (error || !tutor) {
      return NextResponse.json({ error: 'Nieprawidłowy link' }, { status: 404 })
    }

    if (!tutor.active) {
      return NextResponse.json({ error: 'Konto nieaktywne' }, { status: 403 })
    }

    return NextResponse.json({ name: tutor.name, id: tutor.id })
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json()
    if (!login || !password) {
      return NextResponse.json({ error: 'Brak loginu lub hasła' }, { status: 400 })
    }

    const { data: tutor, error } = await supabaseAdmin
      .from('tutors')
      .select('id, name, email, login, password_hash, active')
      .eq('login', login)
      .single()

    if (error || !tutor) {
      return NextResponse.json({ error: 'Nieprawidłowy login lub hasło' }, { status: 401 })
    }

    if (!tutor.active) {
      return NextResponse.json({ error: 'Konto jest nieaktywne' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, tutor.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Nieprawidłowy login lub hasło' }, { status: 401 })
    }

    const token = jwt.sign({ tutorId: tutor.id, name: tutor.name }, JWT_SECRET, { expiresIn: '7d' })

    const response = NextResponse.json({ success: true, name: tutor.name })
    response.cookies.set('tutor_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('tutor_token', '', { maxAge: 0, path: '/' })
  return response
}

export function verifyTutorToken(req: NextRequest): { tutorId: string; name: string } | null {
  try {
    const token = req.cookies.get('tutor_token')?.value
    if (!token) return null
    return jwt.verify(token, JWT_SECRET) as { tutorId: string; name: string }
  } catch {
    return null
  }
}
