import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { defaultStudentPrice, defaultTutorRatePerHour } from '@/lib/pricing'
import { getStaffRole, stripFinancialFields, stripFinancialFieldsDeep } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('course_groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Sekretariat widzi grupy (nazwa, przedmiot, korepetytor), ale nie stawki/cenę (dane finansowe)
  return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name || !body.subject) {
    return NextResponse.json({ error: 'Missing name or subject' }, { status: 400 })
  }

  // Sekretariat może zakładać grupy, ale stawka/cena zostaje ustawiona domyślnie przez admina później
  const tutor_rate_per_hour = role === 'admin'
    ? (body.tutor_rate_per_hour ?? defaultTutorRatePerHour(body.subject))
    : defaultTutorRatePerHour(body.subject)
  const student_price = role === 'admin'
    ? (body.student_price ?? defaultStudentPrice(body.duration_minutes ?? 60))
    : defaultStudentPrice(body.duration_minutes ?? 60)

  const { data, error } = await supabaseAdmin
    .from('course_groups')
    .insert({
      name: body.name,
      subject: body.subject,
      level: body.level || null,
      is_maturzysta: body.is_maturzysta ?? false,
      is_e8: body.is_e8 ?? false,
      location: body.location || 'Wyszków',
      duration_minutes: body.duration_minutes ?? 60,
      tutor_rate_per_hour,
      student_price,
      tutor_id: body.tutor_id || null,
      active: true,
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
  // Sekretariat nie może zmieniać stawki korepetytora ani ceny dla ucznia (dane finansowe)
  const fields = role === 'admin' ? rawFields : stripFinancialFields(rawFields)
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if ('tutor_rate_per_hour' in fields || 'student_price' in fields) {
    const { data: prev } = await supabaseAdmin.from('course_groups').select('tutor_rate_per_hour, student_price').eq('id', id).single()
    if (prev) {
      if ('tutor_rate_per_hour' in fields && prev.tutor_rate_per_hour !== fields.tutor_rate_per_hour) {
        await supabaseAdmin.from('price_history').insert({ entity_type: 'group_tutor_rate', entity_id: id, old_value: prev.tutor_rate_per_hour, new_value: fields.tutor_rate_per_hour })
      }
      if ('student_price' in fields && prev.student_price !== fields.student_price) {
        await supabaseAdmin.from('price_history').insert({ entity_type: 'group_student_price', entity_id: id, old_value: prev.student_price, new_value: fields.student_price })
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('course_groups')
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

  const { error } = await supabaseAdmin.from('course_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
