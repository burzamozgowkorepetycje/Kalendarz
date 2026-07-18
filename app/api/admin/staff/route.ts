import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getStaffRole } from '@/lib/auth'

// Zarzadzanie kontami sekretariatu — dostepne wylacznie dla roli 'admin'.
// Wlasciciel zaklada konto sekretariatu: POST { name, password, role: 'secretariat' }.

export async function GET(req: NextRequest) {
  const role = await getStaffRole(req)
  if (role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .select('id, name, role, active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const role = await getStaffRole(req)
  if (role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, password, role: newRole } = body

  if (!name || !password || !newRole) {
    return NextResponse.json({ error: 'Missing name, password or role' }, { status: 400 })
  }
  if (newRole !== 'admin' && newRole !== 'secretariat') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .insert({ name, password_hash, role: newRole, active: true })
    .select('id, name, role, active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const role = await getStaffRole(req)
  if (role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if ('active' in fields) updates.active = fields.active
  if ('role' in fields) updates.role = fields.role
  if ('name' in fields) updates.name = fields.name
  if ('password' in fields && fields.password) {
    updates.password_hash = await bcrypt.hash(fields.password as string, 10)
  }

  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .update(updates)
    .eq('id', id)
    .select('id, name, role, active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const role = await getStaffRole(req)
  if (role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('staff_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
