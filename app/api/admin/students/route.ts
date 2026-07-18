import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStaffRole, stripFinancialFields, stripFinancialFieldsDeep } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Sekretariat nie widzi stawek (dane finansowe)
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json()
  const body = role === 'admin' ? rawBody : stripFinancialFields(rawBody)
  if (!body.name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('students')
    .insert({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      notes: body.notes || null,
      birth_date: body.birth_date || null,
      grade: body.grade || null,
      location: body.location || 'Wyszków',
      status: body.status || 'potencjalny',
      rate_individual: body.rate_individual ?? null,
      rate_pair: body.rate_pair ?? null,
      rate_group: body.rate_group ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function PUT(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = await req.json()
  const { id, ...rawFields } = rawBody
  // Sekretariat nie może zmieniać stawek ucznia (dane finansowe)
  const fields = role === 'admin' ? rawFields : stripFinancialFields(rawFields)
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Puste stringi dla pól typu DATE → null (Postgres nie przyjmuje "")
  if (fields.birth_date === '') fields.birth_date = null

  const { data, error } = await supabaseAdmin
    .from('students')
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
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('students').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
