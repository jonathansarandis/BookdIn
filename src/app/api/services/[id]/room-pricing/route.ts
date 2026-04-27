// @ts-nocheck
// src/app/api/services/[id]/room-pricing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Verify service belongs to this business
  const { data: service } = await serviceClient
    .from('services')
    .select('id, business_id')
    .eq('id', params.id)
    .single()

  if (!service || service.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  const body = await request.json()
  const { bedroomPrices, bathroomPrices } = body

  // Delete existing room pricing for this service
  const { error: deleteError } = await serviceClient
    .from('room_pricing')
    .delete()
    .eq('service_id', params.id)

  if (deleteError) {
    console.error('Delete error:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Insert new room pricing
  const rows = [
    ...bedroomPrices.map((b: any) => ({
      service_id: params.id,
      business_id: profile.business_id,
      type: 'bedroom',
      count: b.count,
      price: Math.round(parseFloat(b.price || '0') * 100),
    })),
    ...bathroomPrices.map((b: any) => ({
      service_id: params.id,
      business_id: profile.business_id,
      type: 'bathroom',
      count: b.count,
      price: Math.round(parseFloat(b.price || '0') * 100),
    })),
  ]

  const { error: insertError } = await serviceClient
    .from('room_pricing')
    .insert(rows)

  if (insertError) {
    console.error('Insert error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, rows_saved: rows.length })
}
