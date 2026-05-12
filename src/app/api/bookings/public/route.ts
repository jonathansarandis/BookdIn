// @ts-nocheck
// src/app/api/bookings/public/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendBookingConfirmation } from '@/lib/email'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'
import { fromBusinessDateTime } from '@/lib/datetime'
import { createSubmission, logStep, markProcessed, markFailed } from '@/lib/bookings/submissionStore'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00`).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatTime(timeStr: string) {
  return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-AU', {
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    business_id,
    location_id,
    service_id,
    frequency,
    scheduled_date,
    scheduled_time,
    total_price: clientTotal,
    tax_amount: clientTax,
    extras,
    customer,
    address,
    customer_notes,
    utm_data,
    bedrooms,
    bathrooms,
  } = body
  const isFlexible = scheduled_time === 'flexible'
  const effectiveTime = isFlexible ? '09:00' : scheduled_time
  const HARDCODED_DISCOUNTS: Record<string, number> = { weekly: 5, fortnightly: 10, monthly: 10 }

  let submissionId: string | null = null

  try {
    // 1. Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, slug, logo_url, brand_color, contact_email, timezone, stripe_onboarded, stripe_charges_enabled, plan, currency, tax_rate, tax_mode, show_tax, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_from_number, sms_template, sms_enabled, phone')
      .eq('id', business_id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Validate location belongs to this business
    if (!location_id) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }
    const { data: location } = await supabase
      .from('locations')
      .select('id, timezone')
      .eq('id', location_id)
      .eq('business_id', business_id)
      .single()
    if (!location) {
      return NextResponse.json({ error: 'Location not found or does not belong to this business' }, { status: 404 })
    }

    // Create submission audit row — throws → 503 (fail closed)
    try {
      submissionId = await createSubmission(supabase, {
        businessId: business_id,
        locationId: location_id,
        source: 'public',
        rawPayload: body,
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
      })
    } catch (e: any) {
      console.error('[public booking] Failed to create submission record:', e)
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    }

    // 2. Get service details (with room_pricing for server-side recalculation)
    const { data: service } = await supabase
      .from('services')
      .select('*, room_pricing(*)')
      .eq('id', service_id)
      .single()

    if (!service) {
      await markFailed(supabase, submissionId!, 'Service not found')
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Get location-specific base price (Phase 2 multi-location)
    const { data: locService } = await supabase
      .from('location_services')
      .select('base_price, is_enabled')
      .eq('location_id', location.id)
      .eq('service_id', service_id)
      .single()
    if (!locService || !locService.is_enabled) {
      await markFailed(supabase, submissionId!, 'Service not available at this location')
      return NextResponse.json({ error: 'Service not available at this location' }, { status: 400 })
    }

    // 2a. Frequency discount: DB first, hardcoded fallback
    const { data: freqRow } = await supabase
      .from('frequency_discounts')
      .select('discount_percent')
      .eq('service_id', service_id)
      .eq('frequency', frequency)
      .single()
    const discountPct = freqRow?.discount_percent ?? HARDCODED_DISCOUNTS[frequency] ?? 0

    // 2b. Fetch extras early — location-specific prices, scoped to this location + service + business
    let extraDetails: any[] = []
    if (extras?.length > 0) {
      const { data } = await supabase
        .from('location_extras')
        .select(`
          price,
          is_enabled,
          service_extras!inner ( id, name, is_quote_only, service_id, business_id )
        `)
        .eq('location_id', location.id)
        .in('extra_id', extras)
        .eq('is_enabled', true)
        .eq('service_extras.service_id', service_id)
        .eq('service_extras.business_id', business_id)
      extraDetails = (data || []).map((row: any) => ({
        id: row.service_extras.id,
        name: row.service_extras.name,
        price: row.price,
        is_quote_only: row.service_extras.is_quote_only,
      }))
    }

    // 2c. Server-side price recalculation
    const breakdown = calcJobPrice({
      service: {
        id: service.id,
        base_price: locService.base_price,
        pricing_type: service.pricing_type,
        duration_minutes: service.duration_minutes,
      },
      bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
      bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
      selectedExtras: extraDetails.map(ex => ({ price: ex.price, is_quote_only: ex.is_quote_only })),
      roomPricing: service.room_pricing || [],
    })
    const discountedPrice = applyFrequencyDiscount(breakdown.total, discountPct)
    const effectiveTaxRate = business.show_tax && business.tax_rate > 0 ? business.tax_rate : 0
    const taxSplit = calcTaxSplit(discountedPrice, business.tax_mode ?? 'exclusive', effectiveTaxRate)

    // 2d. Mismatch check: ±1 cent tolerance
    const t_validation = Date.now()
    if (Math.abs(taxSplit.total - clientTotal) > 1) {
      await logStep(supabase, submissionId!, { step: 'validation', status: 'failed', duration_ms: Date.now() - t_validation, error: 'pricing mismatch' })
      await markFailed(supabase, submissionId!, 'Pricing mismatch — client total does not match server total')
      return NextResponse.json(
        { error: 'Pricing mismatch — please refresh and try again' },
        { status: 400 },
      )
    }
    await logStep(supabase, submissionId!, { step: 'validation', status: 'ok', duration_ms: Date.now() - t_validation })

    // 3. Create or find customer
    let customerId: string
    const t_cx = Date.now()
    try {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', business_id)
        .eq('email', customer.email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            business_id,
            full_name: customer.full_name,
            email: customer.email,
            phone: customer.phone || null,
          })
          .select('id')
          .single()

        if (customerError) throw new Error('Failed to create customer')
        customerId = newCustomer.id
      }
      await logStep(supabase, submissionId!, { step: 'customer_upsert', status: 'ok', duration_ms: Date.now() - t_cx })
    } catch (e: any) {
      await logStep(supabase, submissionId!, { step: 'customer_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_cx })
      throw e
    }

    // 4. Create address
    let addr: { id: string } | null = null
    const t_addr = Date.now()
    try {
      const { data: addrData, error: addrErr } = await supabase
        .from('addresses')
        .insert({
          business_id,
          customer_id: customerId,
          line1: address.line1,
          city: address.city,
          state: address.state,
          postcode: address.postcode,
          country: 'AU',
          is_default: true,
        })
        .select('id')
        .single()
      if (addrErr) throw addrErr
      addr = addrData
      await logStep(supabase, submissionId!, { step: 'address_upsert', status: 'ok', duration_ms: Date.now() - t_addr })
    } catch (e: any) {
      await logStep(supabase, submissionId!, { step: 'address_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_addr })
      throw new Error(`Failed to create address: ${e.message}`)
    }

    // 5. Create job (pending status — no card yet)
    const tz = location.timezone || business.timezone || 'Australia/Melbourne'
    const scheduledAtIso = fromBusinessDateTime(scheduled_date, effectiveTime, tz)
    const t_job = Date.now()
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        business_id,
        location_id,
        customer_id: customerId,
        address_id: addr?.id,
        service_id,
        status: 'pending',
        scheduled_at: scheduledAtIso,
        duration_minutes: service?.duration_minutes || 120,
        price: taxSplit.subtotal,
        total_price: taxSplit.total,
        tax_amount: taxSplit.tax,
        frequency,
        customer_notes: customer_notes || null,
        payment_status: 'unpaid',
        payment_method: 'card',
        booking_source: 'online',
        is_flexible_time: isFlexible,
        bedrooms: service?.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
        bathrooms: service?.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
      })
      .select('id')
      .single()

    if (jobError) {
      await logStep(supabase, submissionId!, { step: 'job_insert', status: 'failed', error: jobError.message, duration_ms: Date.now() - t_job })
      throw new Error('Failed to create job')
    }
    await logStep(supabase, submissionId!, { step: 'job_insert', status: 'ok', duration_ms: Date.now() - t_job })

    // 5a. Generate single-use card-setup token (14-day expiry)
    const { randomBytes } = await import('crypto')
    const cardSetupToken = randomBytes(32).toString('hex')
    const tokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await supabase.from('jobs').update({
      card_setup_token: cardSetupToken,
      card_setup_token_expires_at: tokenExpiresAt.toISOString(),
    }).eq('id', job.id)

    // 6. Insert extras (using pre-fetched extraDetails from step 2b)
    if (extraDetails.length > 0) {
      await supabase.from('job_extras').insert(
        extraDetails.map(ex => ({
          job_id: job.id,
          extra_id: ex.id,
          name: ex.name,
          price: ex.price,
        }))
      )
    }

    // Fire dispatch (background side effects). Don't await — let it run independently.
    const dispatchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/dispatch`
    fetch(dispatchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id, submission_id: submissionId }),
    }).catch(err => console.error('[bookings/public] dispatch fire failed', err))

    await markProcessed(supabase, submissionId!, job.id)

    return NextResponse.json({
      success: true,
      job_id: job.id,
      total_cents: taxSplit.total,
      service_name: service?.name || null,
    })
  } catch (err: any) {
    console.error('Public booking error:', err)
    if (submissionId) await markFailed(supabase, submissionId!, err.message)
    return NextResponse.json(
      { error: 'Booking could not be completed. Please try again or contact us.' },
      { status: 500 }
    )
  }
}
