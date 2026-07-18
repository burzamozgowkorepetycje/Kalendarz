import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isStaff } from '@/lib/auth'


export async function GET(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ students: [], tutors: [] })

  const like = `%${q}%`

  const [studentsRes, tutorsRes] = await Promise.all([
    supabaseAdmin.from('students').select('id, name, phone, email').or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(8),
    supabaseAdmin.from('tutors').select('id, name, phone, email').or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(8),
  ])

  return NextResponse.json({
    students: studentsRes.data ?? [],
    tutors: tutorsRes.data ?? [],
  })
}
