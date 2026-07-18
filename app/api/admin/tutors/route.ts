import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import { getStaffRole, stripFinancialFields, stripFinancialFieldsDeep } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: tutors, error } = await supabaseAdmin
      .from('tutors')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sekretariat widzi dane kontaktowe korepetytorów, ale nie stawki (dane finansowe)
    return NextResponse.json(role === 'admin' ? tutors : stripFinancialFieldsDeep(tutors))
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const body = role === 'admin' ? rawBody : stripFinancialFields(rawBody)
    const { name, email, phone } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const uniqueLink = randomUUID().split('-')[0]

    const { data, error } = await supabaseAdmin
      .from('tutors')
      .insert({
        name,
        email,
        phone: phone || null,
        unique_link: uniqueLink,
        active: true,
        meet_link: body.meet_link || null,
        subjects: body.subjects ?? null,
        works_online: body.works_online ?? true,
        works_onsite: body.works_onsite ?? true,
        rate_individual: body.rate_individual ?? null,
        rate_pair: body.rate_pair ?? null,
        rate_group: body.rate_group ?? null,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(role === 'admin' ? data[0] : stripFinancialFieldsDeep(data[0]))
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const { id, ...rawFields } = rawBody
    // Sekretariat nie może zmieniać stawek korepetytora (dane finansowe)
    const fields = role === 'admin' ? rawFields : stripFinancialFields(rawFields)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('tutors')
      .update(fields)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(role === 'admin' ? data : stripFinancialFieldsDeep(data))
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const role = await getStaffRole(req)
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const tutorId = searchParams.get('id')

    if (!tutorId) {
      return NextResponse.json({ error: 'Missing tutor id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('tutors')
      .delete()
      .eq('id', tutorId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
