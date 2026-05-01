// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      booking_id,
      business_id,
      customer_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_ad_group,
      utm_term,
      utm_content,
      gclid,
      referrer_url,
      landing_page,
      source_type,
      session_id,
      booking_value_cents,
      manually_entered,
      manual_campaign_label,
    } = body

    if (!business_id) {
      return NextResponse.json({ error: 'business_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('lead_sources')
      .insert({
        booking_id,
        business_id,
        customer_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_ad_group,
        utm_term,
        utm_content,
        gclid,
        referrer_url,
        landing_page,
        source_type: source_type || 'direct',
        session_id,
        booking_value_cents: booking_value_cents || 0,
        lead_status: booking_id ? 'booked' : 'enquiry',
        converted_at: booking_id ? new Date().toISOString() : null,
        manually_entered: manually_entered || false,
        manual_campaign_label,
      })
      .select()
      .single()

    if (error) {
      console.error('Lead source insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Update lead status (booked, cancelled, no_show)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { booking_id, lead_status, booking_value_cents } = body

    if (!booking_id || !lead_status) {
      return NextResponse.json({ error: 'booking_id and lead_status required' }, { status: 400 })
    }

    const updates: any = { lead_status }
    if (lead_status === 'booked') {
      updates.converted_at = new Date().toISOString()
      if (booking_value_cents) updates.booking_value_cents = booking_value_cents
    }
    if (lead_status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('lead_sources')
      .update(updates)
      .eq('booking_id', booking_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
