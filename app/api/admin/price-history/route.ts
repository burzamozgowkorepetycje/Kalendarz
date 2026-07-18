import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hasFinancialAccess } from '@/lib/auth'


export async function GET(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  if (!entityType || !entityId) return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('price_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('changed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!(await hasFinancialAccess(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.entity_type || !body.entity_id) return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('price_history')
    .insert({ entity_type: body.entity_type, entity_id: body.entity_id, old_value: body.old_value ?? null, new_value: body.new_value ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
