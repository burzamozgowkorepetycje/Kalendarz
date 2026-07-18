import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStaffRole, stripFinancialFields, stripFinancialFieldsDeep } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lesson_id = new URL(req.url).searchParams.get('lesson_id')
  if (!lesson_id) return NextResponse.json({ error: 'Missing lesson_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
    .select('*, students(name, email, phone)')
    .eq('lesson_id', lesson_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rawBody = await req.json()
  // Sekretariat może zapisać ucznia do zajęć grupowych, ale nie ustawia kwoty (dane finansowe)
  const { lesson_id, student_id, amount_due } = role === 'admin' ? rawBody : stripFinancialFields(rawBody)

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
    .insert({ lesson_id, student_id, amount_due: amount_due || null, payment_status: 'unpaid' })
    .select('*, students(name, email, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function PUT(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rawBody = await req.json()
  const { id, ...rawFields } = rawBody
  const fields = role === 'admin' ? rawFields : stripFinancialFields(rawFields)

  const { data, error } = await supabaseAdmin
    .from('lesson_students')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function DELETE(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')

  const { error } = await supabaseAdmin.from('lesson_students').delete().eq('id', id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
