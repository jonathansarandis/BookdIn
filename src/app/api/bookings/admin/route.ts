// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'
import { createSubmission, logStep, markProcessed, markFailed } from '@/lib/bookings/submissionStore'

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
    location_id,
    frequency,
    bedrooms,
    bathrooms,
    extras,
    total_price: clientTotal,
    tax_amount: clientTax,
    scheduled_at,
    customer_id,
    customer,
    address_id,
    address,
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

  // Validate location belongs to this business
  if (!location_id) {
    return NextResponse.json({ error: 'Location is required' }, { status: 400 })
  }
  const { data: location } = await admin
    .from('locations')
    .select('id')
    .eq('id', location_id)
    .eq('business_id', businessId)
    .single()
  if (!location) {
    return NextResponse.json({ error: 'Location not found or does not belong to this business' }, { status: 404 })
  }

  // Validate customer + address present for create path (before submission row)
  if (!editJobId) {
    if (!customer_id && !customer) {
      return NextResponse.json({ error: 'Customer details are required' }, { status: 400 })
    }
    if (!address_id && !address) {
      return NextResponse.json({ error: 'Address details are required' }, { status: 400 })
    }
  }

  // Create submission audit row — throws → 503 (fail closed)
  let submissionId: string | null = null
  try {
    submissionId = await createSubmission(admin, {
      businessId,
      locationId: location_id,
      source: 'admin',
      rawPayload: body,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })
  } catch (e: any) {
    console.error('[admin booking] Failed to create submission record:', e)
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  try {
    // Customer resolution (create path only)
    let resolvedCustomerId: string = customer_id || ''
    if (!editJobId && !resolvedCustomerId) {
      const t_cx = Date.now()
      try {
        const { data: existing } = await admin
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .eq('email', customer.email)
          .single()

        if (existing) {
          resolvedCustomerId = existing.id
          await logStep(admin, submissionId!, { step: 'customer_lookup', status: 'ok', duration_ms: Date.now() - t_cx })
        } else {
          const { data: newCx, error: cxErr } = await admin
            .from('customers')
            .insert({
              business_id: businessId,
              full_name: customer.full_name,
              email: customer.email,
              phone: customer.phone || null,
            })
            .select('id')
            .single()
          if (cxErr) throw new Error(cxErr.message)
          resolvedCustomerId = newCx!.id
          await logStep(admin, submissionId!, { step: 'customer_upsert', status: 'ok', duration_ms: Date.now() - t_cx })
        }
      } catch (e: any) {
        await logStep(admin, submissionId!, { step: 'customer_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_cx })
        throw e
      }
    }

    // Address resolution (create path, when no address_id provided)
    let resolvedAddressId: string = address_id || ''
    if (!editJobId && !resolvedAddressId) {
      const t_addr = Date.now()
      try {
        const { data: addr, error: addrErr } = await admin
          .from('addresses')
          .insert({
            business_id: businessId,
            customer_id: resolvedCustomerId,
            line1: address.line1,
            city: address.city,
            state: address.state,
            postcode: address.postcode,
            country: 'AU',
            is_default: true,
          })
          .select('id')
          .single()
        if (addrErr) throw new Error(addrErr.message)
        resolvedAddressId = addr!.id
        await logStep(admin, submissionId!, { step: 'address_upsert', status: 'ok', duration_ms: Date.now() - t_addr })
      } catch (e: any) {
        await logStep(admin, submissionId!, { step: 'address_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_addr })
        throw e
      }
    }

    // 4. Fetch service + room_pricing (eq business_id prevents cross-tenant service use)
    const { data: service } = await admin
      .from('services')
      .select('*, room_pricing(*)')
      .eq('id', service_id)
      .eq('business_id', businessId)
      .single()
    if (!service) {
      await markFailed(admin, submissionId!, 'Service not found')
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

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
    const t_validation = Date.now()
    if (Math.abs(taxSplit.total - clientTotal) > 1) {
      await logStep(admin, submissionId!, { step: 'validation', status: 'failed', duration_ms: Date.now() - t_validation, error: 'pricing mismatch' })
      await markFailed(admin, submissionId!, 'Pricing mismatch — client total does not match server total')
      return NextResponse.json(
        { error: 'Pricing mismatch — please refresh and try again' },
        { status: 400 },
      )
    }
    await logStep(admin, submissionId!, { step: 'validation', status: 'ok', duration_ms: Date.now() - t_validation })

    // ── Edit branch ──────────────────────────────────────────────────────────────
    if (editJobId) {
      const t_job_update = Date.now()
      try {
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
        await logStep(admin, submissionId!, { step: 'job_update', status: 'ok', duration_ms: Date.now() - t_job_update })
      } catch (e: any) {
        await logStep(admin, submissionId!, { step: 'job_update', status: 'failed', error: e.message, duration_ms: Date.now() - t_job_update })
        throw e
      }

      await markProcessed(admin, submissionId!, editJobId)
      return NextResponse.json({ job_id: editJobId, customer_id: resolvedCustomerId, address_id: resolvedAddressId })
    }

    // ── Create branch ────────────────────────────────────────────────────────────
    const t_job = Date.now()
    let job: { id: string }
    try {
      const { data: jobData, error: jobErr } = await admin
        .from('jobs')
        .insert({
          business_id: businessId,
          location_id,
          customer_id: resolvedCustomerId,
          address_id: resolvedAddressId,
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
        throw new Error('Failed to create job')
      }
      job = jobData!
      await logStep(admin, submissionId!, { step: 'job_insert', status: 'ok', duration_ms: Date.now() - t_job })
    } catch (e: any) {
      await logStep(admin, submissionId!, { step: 'job_insert', status: 'failed', error: e.message, duration_ms: Date.now() - t_job })
      throw e
    }

    // CRM: fetch customer, upsert contact, log activity (non-critical)
    const t_crm = Date.now()
    try {
      const { data: customerForCrm } = await admin
        .from('customers')
        .select('full_name, email, phone')
        .eq('id', resolvedCustomerId)
        .single()

      if (customerForCrm) {
        const { upsertCrmContact, logCrmActivity } = await import('@/lib/crm/upsert')
        const crmResult = await upsertCrmContact(admin, {
          business_id: businessId,
          customer_id,
          full_name: customerForCrm.full_name,
          email: customerForCrm.email,
          phone: customerForCrm.phone || null,
          source: 'admin',
        })
        if (crmResult.contact_id) {
          await logCrmActivity(admin, {
            business_id: businessId,
            contact_id: crmResult.contact_id,
            type: 'note',
            title: crmResult.created ? 'Booking created in admin (new lead)' : 'Booking created in admin',
            body: `Booked ${service.name} via admin. Total: $${(taxSplit.total / 100).toFixed(2)}`,
          })
        } else if (crmResult.error) {
          console.error('[admin booking] CRM upsert failed (non-blocking):', crmResult.error)
        }
      }
      await logStep(admin, submissionId!, { step: 'crm_upsert', status: 'ok', duration_ms: Date.now() - t_crm })
    } catch (err: any) {
      console.error('[admin booking] CRM block threw (non-blocking):', err.message)
      await logStep(admin, submissionId!, { step: 'crm_upsert', status: 'failed', error: err.message, duration_ms: Date.now() - t_crm })
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

    const t_email = Date.now()
    try {
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
      await logStep(admin, submissionId!, { step: 'customer_email', status: emailStatus === 'failed' ? 'failed' : 'ok', duration_ms: Date.now() - t_email })
    } catch (e: any) {
      emailStatus = 'failed'
      await logStep(admin, submissionId!, { step: 'customer_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_email })
    }

    await markProcessed(admin, submissionId!, job.id)
    return NextResponse.json({ job_id: job.id, emailStatus, customer_id: resolvedCustomerId, address_id: resolvedAddressId })
  } catch (err: any) {
    console.error('[admin booking] Unhandled error:', err)
    if (submissionId) {
      await logStep(admin, submissionId!, { step: 'unhandled', status: 'failed', error: err.message })
      await markFailed(admin, submissionId!, err.message)
    }
    return NextResponse.json(
      { error: 'Booking could not be completed. Please try again or contact us.' },
      { status: 500 }
    )
  }
}
