import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
    const { data: slots, error } = await supabaseAdmin
      .from('time_slots')
      .select('*, tutors(name, email)')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(slots)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { date, startTime, endTime, durationMinutes, tutorId } =
      await req.json()

    if (!date || !startTime || !endTime || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('time_slots')
      .insert({
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        tutor_id: tutorId || null,
        status: 'available',
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

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const slotId = searchParams.get('id')

    if (!slotId) {
      return NextResponse.json({ error: 'Missing slot id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('time_slots')
      .delete()
      .eq('id', slotId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
