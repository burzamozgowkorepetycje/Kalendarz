import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { defaultStudentPrice, defaultTutorRatePerHour } from '@/lib/pricing'

function verifyAdmin(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('course_groups')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name || !body.subject) {
    return NextResponse.json({ error: 'Missing name or subject' }, { status: 400 })
  }

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
      tutor_rate_per_hour: body.tutor_rate_per_hour ?? defaultTutorRatePerHour(body.subject),
      student_price: body.student_price ?? defaultStudentPrice(body.duration_minutes ?? 60),
      tutor_id: body.tutor_id || null,
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
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('course_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
