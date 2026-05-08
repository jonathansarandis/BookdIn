// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'

const HARDCODED_DISCOUNTS: Record<string, number> = { weekly: 5, fortnightly: 10, monthly: 10 }

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()

  // 1. Require authenticated session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  const businessId = rawProfile?.business_id
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    editJobId,
    service_id,
    frequency,
    bedrooms,
    bathrooms,
    extras,
    total_price: clientTotal,
    tax_amount: clientTax,
    scheduled_at,
    customer_id,
    address_id,
    provider_id,
    notes,
    booking_source,
    status,
    payment_method,
    rebook_source_job_id,
    is_flexible_time,
  } = body

  const admin = createAdminClient()

  // 2. Verify edit job ownership (404 avoids leaking job existence)
  if (editJobId) {
    const { data: existingJob } = await admin
      .from('jobs')
      .select('business_id')
      .eq('id', editJobId)
      .single()
    if (!existingJob || existingJob.business_id !== businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // 3. Fetch business (pricing fields + email fields)
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, brand_color, logo_url, contact_email, timezone, stripe_onboarded, plan, currency, tax_rate, tax_mode, show_tax')
    .eq('id', businessId)
    .single()
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // 4. Fetch service + room_pricing (eq business_id prevents cross-tenant service use)
  const { data: service } = await admin
    .from('services')
    .select('*, room_pricing(*)')
    .eq('id', service_id)
    .eq('business_id', businessId)
    .single()
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

  // 5. Frequency discount: DB first, hardcoded fallback
  const { data: freqRow } = await admin
    .from('frequency_discounts')
    .select('discount_percent')
    .eq('service_id', service_id)
    .eq('frequency', frequency)
    .single()
  const discountPct = freqRow?.discount_percent ?? HARDCODED_DISCOUNTS[frequency] ?? 0

  // 6. Fetch extras (tightened: service_id + business_id prevents cross-tenant/cross-service borrowing)
  let extraDetails: any[] = []
  if (extras?.length > 0) {
    const { data } = await admin
      .from('service_extras')
      .select('*')
      .in('id', extras)
      .eq('service_id', service_id)
      .eq('business_id', businessId)
    extraDetails = data || []
  }

  // 7. Server-side price recalculation
  const breakdown = calcJobPrice({
    service: {
      id: service.id,
      base_price: service.base_price,
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

  // 8. Mismatch check: ±1 cent tolerance
  if (Math.abs(taxSplit.total - clientTotal) > 1) {
    return NextResponse.json(
      { error: 'Pricing mismatch — please refresh and try again' },
      { status: 400 },
    )
  }

  // ── Edit branch ──────────────────────────────────────────────────────────────
  if (editJobId) {
    await admin
      .from('jobs')
      .update({
        service_id,
        price: taxSplit.subtotal,
        total_price: taxSplit.total,
        tax_amount: taxSplit.tax,
        duration_minutes: service.duration_minutes || 120,
        bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
        bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
        scheduled_at,
        frequency,
        notes: notes ?? null,
        provider_id: provider_id ?? null,
        is_flexible_time: is_flexible_time ?? false,
      })
      .eq('id', editJobId)

    await admin.from('job_extras').delete().eq('job_id', editJobId)
    if (extraDetails.length > 0) {
      await admin.from('job_extras').insert(
        extraDetails.map(ex => ({
          job_id: editJobId,
          extra_id: ex.id,
          name: ex.name,
          price: ex.price,
        }))
      )
    }

    await admin.from('activity_logs').insert({
      business_id: businessId,
      event_type: 'booking_updated',
      description: 'Booking updated',
      entity_type: 'job',
      entity_id: editJobId,
    })

    return NextResponse.json({ job_id: editJobId })
  }

  // ── Create branch ────────────────────────────────────────────────────────────
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .insert({
      business_id: businessId,
      customer_id,
      address_id,
      service_id,
      provider_id: provider_id ?? null,
      status: status ?? (provider_id ? 'assigned' : 'pending'),
      scheduled_at,
      duration_minutes: service.duration_minutes || 120,
      price: taxSplit.subtotal,
      total_price: taxSplit.total,
      tax_amount: taxSplit.tax,
      frequency,
      notes: notes ?? null,
      booking_source: booking_source ?? 'admin',
      payment_method: payment_method ?? 'card',
      payment_status: 'unpaid',
      bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
      bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
      is_flexible_time: is_flexible_time ?? false,
    })
    .select('id')
    .single()

  if (jobErr) {
    console.error('[admin booking] job insert failed:', jobErr)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  if (extraDetails.length > 0) {
    await admin.from('job_extras').insert(
      extraDetails.map(ex => ({
        job_id: job.id,
        extra_id: ex.id,
        name: ex.name,
        price: ex.price,
      }))
    )
  }

  await admin.from('activity_logs').insert({
    business_id: businessId,
    event_type: rebook_source_job_id ? 'booking_rebooked' : 'booking_created',
    description: rebook_source_job_id ? 'Booking rebooked' : 'Booking created',
    entity_type: 'job',
    entity_id: job.id,
    ...(rebook_source_job_id ? { metadata: { source_job_id: rebook_source_job_id } } : {}),
  })

  // Confirmation email — fetch customer + address for email assembly
  const { data: jobForEmail } = await admin
    .from('jobs')
    .select('customer:customers(full_name, email), address:addresses(line1, city, state, postcode)')
    .eq('id', job.id)
    .single()

  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'

  if (jobForEmail?.customer && jobForEmail?.address) {
    const cardSetupUrl = business.stripe_onboarded
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${job.id}/card-setup`
      : undefined

    const result = await sendBookingConfirmation({
      job: {
        id: job.id,
        scheduled_at,
        total_price: taxSplit.total,
        tax_amount: taxSplit.tax,
        is_flexible_time: is_flexible_time ?? false,
      },
      customer: jobForEmail.customer,
      business: {
        name: business.name,
        brand_color: business.brand_color,
        logo_url: business.logo_url,
        contact_email: business.contact_email,
        timezone: business.timezone,
        plan: business.plan,
        currency: business.currency,
      },
      address: jobForEmail.address,
      service: { name: service.name },
      cardSetupUrl,
      business_id: businessId,
    })

    emailStatus = result.success ? 'sent' : 'failed'

    if (result.success) {
      await admin
        .from('jobs')
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq('id', job.id)
    }
  }

  return NextResponse.json({ job_id: job.id, emailStatus })
}
