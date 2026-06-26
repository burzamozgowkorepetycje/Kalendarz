import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { slotId, studentName, link } = await req.json()

    if (!slotId || !studentName || !link) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get tutor
    const { data: tutor, error: tutorError } = await supabaseAdmin
      .from('tutors')
      .select('*')
      .eq('unique_link', link)
      .single()

    if (tutorError || !tutor) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    // Get slot
    const { data: slot, error: slotError } = await supabaseAdmin
      .from('time_slots')
      .select('*')
      .eq('id', slotId)
      .eq('status', 'available')
      .single()

    if (slotError || !slot) {
      return NextResponse.json(
        { error: 'Slot not available' },
        { status: 404 }
      )
    }

    // Update slot
    const { error: updateError } = await supabaseAdmin
      .from('time_slots')
      .update({
        tutor_id: tutor.id,
        student_name: studentName,
        status: 'booked',
      })
      .eq('id', slotId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Send confirmation email
    await sendBookingConfirmation(
      tutor.email,
      tutor.name,
      studentName,
      slot.date,
      slot.start_time,
      slot.duration_minutes
    )

    return NextResponse.json({ success: true, slot })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
