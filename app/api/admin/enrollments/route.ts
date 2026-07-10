import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('student_id')

  let query = supabaseAdmin.from('student_enrollments').select('*').order('created_at', { ascending: false })
  if (studentId) query = query.eq('student_id', studentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.student_id || !body.subject) {
    return NextResponse.json({ error: 'Missing student_id or subject' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('student_enrollments')
    .insert({
      student_id: body.student_id,
      subject: body.subject,
      mode: body.mode || 'individual',
      location: body.location || 'Wyszków',
      duration_minutes: body.duration_minutes ?? 60,
      group_name: body.mode === 'group' ? (body.group_name || null) : null,
      is_maturzysta: body.is_maturzysta ?? false,
      is_e8: body.is_e8 ?? false,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Jeśli oznaczamy jako nieaktywne (rezygnacja), zapisz datę
  if (fields.active === false && !fields.cancelled_at) {
    fields.cancelled_at = new Date().toISOString()
  }
  if (fields.active === true) {
    fields.cancelled_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('student_enrollments')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('student_enrollments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
