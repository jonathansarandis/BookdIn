// @ts-nocheck
// src/app/api/customers/route.ts
// Create a customer for the authenticated user's business.
// Handles the (business_id, email) unique constraint with a friendly message
// instead of leaking the raw "duplicate key value violates unique constraint".
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const firstName = (body.first_name || '').trim()
  const lastName = (body.last_name || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()
  const email = (body.email || '').trim().toLowerCase() || null
  const phone = (body.phone || '').trim() || null
  const notes = (body.notes || '').trim() || null

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
  }

  // If an email is given, pre-check for an existing customer so we can return a
  // helpful message (and their id) rather than relying only on the DB error.
  if (email) {
    const { data: existing } = await serviceClient
      .from('customers')
      .select('id, full_name')
      .eq('business_id', profile.business_id)
      .eq('email', email)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: `A customer with this email already exists (${existing.full_name}).`, existingId: existing.id },
        { status: 409 }
      )
    }
  }

  const { data: created, error } = await serviceClient
    .from('customers')
    .insert({ business_id: profile.business_id, full_name: fullName, email, phone, notes })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation (race between the pre-check and insert)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A customer with this email already exists.' },
        { status: 409 }
      )
    }
    console.error('[customers/create] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: created.id })
}
