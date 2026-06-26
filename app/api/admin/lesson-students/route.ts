import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lesson_id = new URL(req.url).searchParams.get('lesson_id')
  if (!lesson_id) return NextResponse.json({ error: 'Missing lesson_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
    .select('*, students(name, email, phone)')
    .eq('lesson_id', lesson_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { lesson_id, student_id, amount_due } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
    .insert({ lesson_id, student_id, amount_due: amount_due || null, payment_status: 'unpaid' })
    .select('*, students(name, email, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...fields } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
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

  const { error } = await supabaseAdmin.from('lesson_students').delete().eq('id', id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
