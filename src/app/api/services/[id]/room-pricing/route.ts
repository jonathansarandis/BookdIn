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
  // locationId scopes this save to one location. null/undefined = the
  // service-level default set (location_id IS NULL). A specific id overrides
  // for that location only. Saving one scope must never touch the others.
  const locationId: string | null = body.locationId ?? null

  // If scoped to a specific location, make sure it belongs to this business.
  if (locationId != null) {
    const { data: location } = await serviceClient
      .from('locations')
      .select('id, business_id')
      .eq('id', locationId)
      .single()

    if (!location || location.business_id !== profile.business_id) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }
  }

  // Delete only the rows in this (service, location) scope.
  // location_id IS NULL needs .is(); a specific id needs .eq().
  let deleteQuery = serviceClient
    .from('room_pricing')
    .delete()
    .eq('service_id', params.id)
  deleteQuery = locationId == null
    ? deleteQuery.is('location_id', null)
    : deleteQuery.eq('location_id', locationId)

  const { error: deleteError } = await deleteQuery

  if (deleteError) {
    console.error('Delete error:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Insert new room pricing for this scope
  const rows = [
    ...bedroomPrices.map((b: any) => ({
      service_id: params.id,
      business_id: profile.business_id,
      location_id: locationId,
      type: 'bedroom',
      count: b.count,
      price: Math.round(parseFloat(b.price || '0') * 100),
    })),
    ...bathroomPrices.map((b: any) => ({
      service_id: params.id,
      business_id: profile.business_id,
      location_id: locationId,
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
