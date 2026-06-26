import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const link = searchParams.get('link')
    const month = searchParams.get('month')

    if (!link) {
      return NextResponse.json({ error: 'Missing link' }, { status: 400 })
    }

    // Get tutor by unique link
    const { data: tutor, error: tutorError } = await supabase
      .from('tutors')
      .select('*')
      .eq('unique_link', link)
      .single()

    if (tutorError || !tutor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    // Get available slots for tutor this month
    let query = supabase
      .from('time_slots')
      .select('*')
      .eq('status', 'available')

    if (month) {
      const [year, monthNum] = month.split('-')
      const startDate = `${year}-${monthNum}-01`
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0)
        .toISOString()
        .split('T')[0]
      query = query
        .gte('date', startDate)
        .lte('date', endDate)
    }

    const { data: slots, error: slotsError } = await query

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 })
    }

    return NextResponse.json({
      tutor: {
        id: tutor.id,
        name: tutor.name,
        email: tutor.email,
      },
      slots,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
