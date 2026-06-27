import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomUUID } from 'crypto'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${ADMIN_PASSWORD}`
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
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

    return NextResponse.json(tutors)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
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

    return NextResponse.json(data[0])
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, ...fields } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('tutors')
      .update(fields)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) {
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
