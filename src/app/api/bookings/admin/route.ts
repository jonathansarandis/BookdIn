// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'
import { createSubmission, logStep, markProcessed, markFailed } from '@/lib/bookings/submissionStore'
import { inferLocationIdFromState } from '@/lib/bookings/inferLocation'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    custom_items,
    lead_source,
  } = body
  let location_id = body.location_id

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
    .select('id, name, brand_color, logo_url, contact_email, timezone, stripe_onboarded, stripe_charges_enabled, plan, currency, tax_rate, tax_mode, show_tax, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_template, sms_enabled, phone')
    .eq('id', businessId)
    .single()
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // Validate location belongs to this business — if the client didn't send one,
  // try to infer it from the booking's address state before failing closed.
  if (!location_id) {
    let stateForInference = address?.state
    if (!stateForInference && address_id) {
      const { data: existingAddr } = await admin.from('addresses').select('state').eq('id', address_id).single()
      stateForInference = existingAddr?.state
    }
    location_id = await inferLocationIdFromState(admin, businessId, stateForInference)
  }
  if (!location_id) {
    return NextResponse.json({ error: 'Location is required' }, { status: 400 })
  }
  const { data: location } = await admin
    .from('locations')
    .select('id, timezone')
    .eq('id', location_id)
    .eq('business_id', businessId)
    .single()
  if (!location) {
    return NextResponse.json({ error: 'Location not found or does not belong to this business' }, { status: 404 })
  }
  // The booking's own location timezone always wins over the business default for
  // anything shown to the customer or staff (confirmation email, SMS, notifications) —
  // a business with locations in multiple timezones would otherwise tell the customer
  // the wrong appointment time.
  const effectiveTimezone = location.timezone || business.timezone || 'Australia/Melbourne'

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
    // A customer_id sent directly (picked from the existing-customer dropdown) or
    // found by email lookup below both mean this is a returning customer.
    let isExistingCustomer = !!customer_id
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
          isExistingCustomer = true
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
    const [{ data: service }, { data: locService }] = await Promise.all([
      admin.from('services').select('*, room_pricing(*)').eq('id', service_id).eq('business_id', businessId).single(),
      admin.from('location_services').select('base_price').eq('location_id', location_id).eq('service_id', service_id).single(),
    ])
    if (!service) {
      await markFailed(admin, submissionId!, 'Service not found')
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    const effectiveBasePrice = locService?.base_price ?? service.base_price

    // 5. Frequency discount — must match the client-side lookup exactly (booking/page.tsx),
    // since the client already computed and sent total_price using it.
    // frequency_discounts is per-business (not per-service) since migration
    // 20260507_freq_discounts_per_business.sql — service_id was dropped from the table.
    // No row, or a row with is_enabled=false, both mean 0% — no hardcoded fallback,
    // matching the client (which has none either).
    const effectiveFrequency = service.allows_recurring === false ? 'one_time' : frequency
    const { data: freqRow } = await admin
      .from('frequency_discounts')
      .select('discount_percent, is_enabled')
      .eq('business_id', businessId)
      .eq('frequency', effectiveFrequency)
      .single()
    const discountPct = service.frequency_discount_eligible && freqRow?.is_enabled
      ? freqRow.discount_percent
      : 0

    // 6. Fetch extras — join service_extras junction to extras catalog.
    //    extras[] contains extras.id values. Filter by service_id to prevent cross-service borrowing;
    //    business scoping comes from the extras catalog (extras.business_id verified via service ownership).
    let extraDetails: any[] = []
    if (extras?.length > 0) {
      const extraIds: string[] = extras.map((e: any) => e.id)
      const extrasQtyMap: Record<string, number> = {}
      for (const e of extras) extrasQtyMap[e.id] = e.quantity ?? 1

      const { data: junctionRows } = await admin
        .from('service_extras')
        .select(`
          price_override,
          extras!inner (id, name, default_price, is_quote_only)
        `)
        .in('extra_id', extraIds)
        .eq('service_id', service_id)
      extraDetails = (junctionRows || []).map((j: any) => ({
        id: j.extras.id,
        name: j.extras.name,
        price: j.price_override ?? j.extras.default_price,
        is_quote_only: j.extras.is_quote_only,
        quantity: extrasQtyMap[j.extras.id] ?? 1,
      }))
    }

    // 7. Server-side price recalculation — uses location-specific base price when set
    const breakdown = calcJobPrice({
      service: {
        id: service.id,
        base_price: effectiveBasePrice,
        pricing_type: service.pricing_type,
        duration_minutes: service.duration_minutes,
      },
      bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
      bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
      selectedExtras: extraDetails.map(ex => ({ price: ex.price, is_quote_only: ex.is_quote_only, quantity: ex.quantity })),
      roomPricing: service.room_pricing || [],
      locationId: location_id || null,
    })
    const discountedPrice = applyFrequencyDiscount(breakdown.total, discountPct)
    const customItemsTotal = Array.isArray(custom_items)
      ? custom_items.reduce((sum: number, ci: any) => sum + (Number(ci.price_cents) || 0), 0)
      : 0
    const effectiveTaxRate = business.show_tax && business.tax_rate > 0 ? business.tax_rate : 0
    const taxSplit = calcTaxSplit(discountedPrice + customItemsTotal, business.tax_mode ?? 'exclusive', effectiveTaxRate)

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
          const { error: editExtrasErr } = await admin.from('job_extras').insert(
            extraDetails.map(ex => ({
              job_id: editJobId,
              extra_id: ex.id,
              name: ex.name,
              price: ex.is_quote_only ? 0 : ex.price,
              quantity: ex.quantity ?? 1,
            }))
          )
          if (editExtrasErr) {
            console.error('[admin booking] job_extras insert (edit) failed:', editExtrasErr)
            console.error('[admin booking] extraDetails being inserted:', JSON.stringify(extraDetails))
          }
        }

        if (Array.isArray(custom_items) && custom_items.length > 0) {
          await admin.from('job_extras').insert(
            custom_items.map((ci: any) => ({
              job_id: editJobId,
              extra_id: null,
              name: ci.name,
              price: ci.price_cents,
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
          frequency: effectiveFrequency,
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

    // Recurring bookings — this is where the actual series gets set up. Booking with
    // frequency=weekly/fortnightly/monthly used to only ever create the ONE job above;
    // "frequency" was stored on it as an inert label with nothing that ever generated
    // the following occurrences. The real recurring engine (materializeRecurringJobs,
    // used by the daily cron + the manual /recurring "Sync now" button) only acts on
    // rows in recurring_schedules — nothing here ever inserted one. Fix: create the
    // schedule now, seeded to start the day AFTER this job, then materialize
    // immediately so the calendar fills in without waiting for tomorrow's 8am cron.
    if (['weekly', 'fortnightly', 'monthly'].includes(effectiveFrequency)) {
      const t_recurring = Date.now()
      try {
        const { getNextDate } = await import('@/lib/recurring/materialize')
        const nextOccurrence = getNextDate(new Date(scheduled_at), effectiveFrequency)
        const { data: scheduleRow, error: scheduleErr } = await admin
          .from('recurring_schedules')
          .insert({
            business_id: businessId,
            customer_id: resolvedCustomerId,
            service_id,
            address_id: resolvedAddressId,
            provider_id: provider_id ?? null,
            frequency: effectiveFrequency,
            next_scheduled_at: nextOccurrence.toISOString(),
            // The just-booked job itself (linked below via recurring_schedule_id)
            // is this schedule's true first occurrence — anchor phase-locks to
            // its actual date, not next_occurrence, so day-of-week/day-of-month
            // stays correct from the very start. Immutable after this.
            anchor_date: new Date(scheduled_at).toISOString(),
            is_active: true,
            price: taxSplit.subtotal,
            auto_charge: (payment_method ?? 'card') === 'card',
            notes: notes ?? null,
          })
          .select('id')
          .single()

        if (scheduleErr) {
          console.error('[admin booking] recurring_schedules insert failed:', scheduleErr)
        } else {
          await admin.from('jobs').update({ recurring_schedule_id: scheduleRow.id }).eq('id', job.id)
          const { materializeRecurringJobs } = await import('@/lib/recurring/materialize')
          const result = await materializeRecurringJobs(admin, { businessId })
          console.log(`[admin booking] materialized ${result.jobsCreated} future occurrence(s) for new recurring schedule ${scheduleRow.id}`)
        }
        await logStep(admin, submissionId!, { step: 'recurring_schedule', status: scheduleErr ? 'failed' : 'ok', duration_ms: Date.now() - t_recurring, error: scheduleErr?.message })
      } catch (e: any) {
        // Non-critical — the single job booked today still exists either way, just log it
        console.error('[admin booking] recurring schedule setup failed (non-blocking):', e.message)
        await logStep(admin, submissionId!, { step: 'recurring_schedule', status: 'failed', duration_ms: Date.now() - t_recurring, error: e.message })
      }
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
          // Bug fix: this used to reference the raw `customer_id` body param, which
          // is undefined whenever the booking was for a brand-new customer (that
          // path only sets `resolvedCustomerId` after creating the customer row) —
          // every new-customer admin booking was silently failing to link to CRM.
          customer_id: resolvedCustomerId,
          full_name: customerForCrm.full_name,
          email: customerForCrm.email,
          phone: customerForCrm.phone || null,
          // The VA's explicit pick (ManualSourceSelector) always wins when given;
          // otherwise fall back to 'returning' for a known customer, 'admin' default
          // for a genuinely new one with no source selected.
          source: lead_source || (isExistingCustomer ? 'returning' : 'admin'),
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
      const { error: jobExtrasErr } = await admin.from('job_extras').insert(
        extraDetails.map(ex => ({
          job_id: job.id,
          extra_id: ex.id,
          name: ex.name,
          price: ex.is_quote_only ? 0 : ex.price,
          quantity: ex.quantity ?? 1,
        }))
      )
      if (jobExtrasErr) {
        console.error('[admin booking] job_extras insert failed:', jobExtrasErr)
        console.error('[admin booking] extraDetails being inserted:', JSON.stringify(extraDetails))
      }
    }

    if (Array.isArray(custom_items) && custom_items.length > 0) {
      await admin.from('job_extras').insert(
        custom_items.map((ci: any) => ({
          job_id: job.id,
          extra_id: null,
          name: ci.name,
          price: ci.price_cents,
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
      .select('price_override, customer:customers(full_name, email, phone), address:addresses(line1, city, state, postcode)')
      .eq('id', job.id)
      .single()

    let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'

    const t_email = Date.now()
    try {
      if (jobForEmail?.customer && jobForEmail?.address) {
        // Generate the single-use card-setup token the same way the public booking
        // flow does (bookings/public/route.ts), so the emailed link goes to the
        // working /secure-card/[token] page instead of the legacy Checkout Session
        // redirect at /api/bookings/[id]/card-setup — that route never wrote the
        // saved payment method back to the database, so cards entered via
        // admin-created bookings' emails were silently lost.
        let cardSetupUrl: string | undefined
        if (business.stripe_charges_enabled) {
          const { randomBytes } = await import('crypto')
          const cardSetupToken = randomBytes(32).toString('hex')
          const tokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          await admin.from('jobs').update({
            card_setup_token: cardSetupToken,
            card_setup_token_expires_at: tokenExpiresAt.toISOString(),
          }).eq('id', job.id)
          cardSetupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/secure-card/${cardSetupToken}`
        }

        const result = await sendBookingConfirmation({
          job: {
            id: job.id,
            scheduled_at,
            total_price: taxSplit.total,
            price_override: jobForEmail?.price_override ?? null,
            tax_amount: taxSplit.tax,
            is_flexible_time: is_flexible_time ?? false,
            bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
            bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
            extras: extraDetails.map((e: any) => ({ name: e.name, price: e.is_quote_only ? 0 : e.price, quantity: e.quantity ?? 1 })),
          },
          customer: jobForEmail.customer,
          business: {
            name: business.name,
            brand_color: business.brand_color,
            logo_url: business.logo_url,
            contact_email: business.contact_email,
            timezone: effectiveTimezone,
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

    // Owner notification email (non-critical)
    const t_owner_email = Date.now()
    try {
      if (!business.contact_email) {
        await logStep(admin, submissionId!, { step: 'owner_email', status: 'failed', error: 'no contact_email configured', duration_ms: Date.now() - t_owner_email })
      } else {
        const ownerTz = effectiveTimezone
        const ownerDateStr = new Date(scheduled_at).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ownerTz })
        const ownerTimeStr = (is_flexible_time ?? false)
          ? 'Flexible time'
          : new Date(scheduled_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ownerTz })
        const ownerCustomer = jobForEmail?.customer
        const ownerAddress = jobForEmail?.address
        const frequencyLabel = frequency ? (({ one_time: 'One Time', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' } as Record<string, string>)[frequency] || frequency) : null
        const { error: ownerEmailErr } = await resend.emails.send({
          from: `BookdIn <hello@bookdin.co>`,
          to: business.contact_email,
          bcc: 'jonathan.sarandis@gmail.com',
          reply_to: ownerCustomer?.email,
          subject: `📞 New booking — call ${ownerCustomer?.full_name} now`,
          html: `
            <div style="margin: 0; padding: 40px 20px; background: #f5f3ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 48px 40px; text-align: center;">
                <div style="margin: 0 0 40px 0;"><div style="display: inline-block; background: #0a1228; padding: 12px 24px; border-radius: 10px; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;"><span style="color: #ffffff;">Bookd</span><span style="color: #2563EB;">In</span></div></div>
                <h1 style="font-size: 28px; font-weight: 700; color: #0a1929; margin: 0 0 24px 0;">New Booking</h1>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 40px 0;">You have a new booking from <strong>${ownerCustomer?.full_name}</strong></p>
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px 0;">${ownerCustomer?.phone ? `<a href="tel:${ownerCustomer.phone}" style="color: ${business.brand_color || '#1E9BFF'}; text-decoration: none;">${ownerCustomer.phone}</a> &middot; ` : ''}<a href="mailto:${ownerCustomer?.email}" style="color: ${business.brand_color || '#1E9BFF'}; text-decoration: none;">${ownerCustomer?.email}</a></p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${ownerDateStr}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${ownerTimeStr}</p>
                ${frequencyLabel ? `<p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${frequencyLabel}</p>` : ''}
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${ownerAddress?.line1}, ${ownerAddress?.city} ${ownerAddress?.state} ${ownerAddress?.postcode}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${service?.name}</p>
                <p style="font-size: 18px; font-weight: 700; color: #0a1929; margin: 8px 0 32px 0;"><strong>Total: $${(taxSplit.total / 100).toFixed(2)}</strong></p>
                <p style="font-size: 14px; color: #dc2626; font-weight: 500; margin: 0 0 40px 0; line-height: 1.6;"><strong>Action required:</strong> Call the customer now to confirm the booking and remind them to complete the secure card details link in their email.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/${job.id}" style="display: inline-block; background: ${business.brand_color || '#1E9BFF'}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">View booking →</a>
              </div>
            </div>
          `,
        })
        await logStep(admin, submissionId!, {
          step: 'owner_email',
          status: ownerEmailErr ? 'failed' : 'ok',
          duration_ms: Date.now() - t_owner_email,
          ...(ownerEmailErr ? { error: String(ownerEmailErr) } : {}),
        })
      }
    } catch (e: any) {
      await logStep(admin, submissionId!, { step: 'owner_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_owner_email })
    }

    // Customer SMS (non-critical)
    const t_sms = Date.now()
    try {
      const { sendDialpadSms } = await import('@/lib/sms/dialpad')
      const { formatDateForSms, formatTimeForSms } = await import('@/lib/sms/format')
      const smsCustomer = jobForEmail?.customer
      const smsTz = effectiveTimezone
      const smsIsFlexible = is_flexible_time ?? false

      const smsResult = await sendDialpadSms({
        business: {
          sms_provider: business.sms_provider,
          sms_api_key_encrypted: business.sms_api_key_encrypted,
          sms_api_key_iv: business.sms_api_key_iv,
          sms_user_id: business.sms_user_id,
          sms_template: business.sms_template,
          sms_enabled: business.sms_enabled,
        },
        toPhone: smsCustomer?.phone || '',
        vars: {
          customer_name: smsCustomer?.full_name?.split(' ')[0] || smsCustomer?.full_name || '',
          service_name: service?.name || 'Service',
          date: formatDateForSms(scheduled_at, smsTz),
          time: formatTimeForSms(scheduled_at, smsTz, smsIsFlexible),
          business_name: business.name,
          business_phone: business.phone || '',
          total: `$${((jobForEmail?.price_override ?? taxSplit.total) / 100).toFixed(2)}`,
          customer_id: resolvedCustomerId || undefined,
          customer_first_name: smsCustomer?.full_name?.split(' ')[0] || smsCustomer?.full_name || '',
          customer_last_name: smsCustomer?.full_name?.split(' ').slice(1).join(' ') || undefined,
          customer_email: smsCustomer?.email || undefined,
        },
      })

      const smsUpdates: Record<string, any> = { sms_status: smsResult.status }
      if (smsResult.error) smsUpdates.sms_error = smsResult.error.slice(0, 500)
      if (smsResult.status === 'sent') smsUpdates.sms_sent_at = new Date().toISOString()

      const { error: smsUpdateError } = await admin.from('jobs').update(smsUpdates).eq('id', job.id)
      if (smsUpdateError) console.error('Failed to persist SMS audit:', smsUpdateError)

      if (smsResult.status === 'failed') {
        console.error('SMS failed:', smsResult.error, 'job:', job.id)
      } else if (smsResult.status === 'skipped') {
        console.log('SMS skipped:', smsResult.error, 'job:', job.id)
      } else {
        console.log('SMS sent:', smsResult.message_id, 'job:', job.id)
      }
      await logStep(admin, submissionId!, { step: 'sms', status: 'ok', duration_ms: Date.now() - t_sms })
    } catch (e: any) {
      console.error('SMS handler threw (booking still successful):', e)
      try {
        await admin.from('jobs').update({
          sms_status: 'failed',
          sms_error: `handler threw: ${e.message?.slice(0, 400)}`,
        }).eq('id', job.id)
      } catch { /* best-effort audit */ }
      await logStep(admin, submissionId!, { step: 'sms', status: 'failed', error: e.message, duration_ms: Date.now() - t_sms })
    }

    // Staff in-app notifications (non-critical)
    const t_notif = Date.now()
    try {
      const { data: staffProfiles } = await admin
        .from('profiles')
        .select('id, email, full_name')
        .eq('business_id', businessId)

      const notifCustomer = jobForEmail?.customer
      const notifTz = effectiveTimezone
      const notifDateStr = new Date(scheduled_at).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: notifTz })

      if (staffProfiles?.length) {
        await admin.from('notifications').insert(
          staffProfiles.map(staff => ({
            business_id: businessId,
            user_id: staff.id,
            type: 'call_prompt',
            title: `📞 Call ${notifCustomer?.full_name} to confirm booking`,
            body: `New admin booking for ${service?.name} on ${notifDateStr}. Call to confirm and ensure they complete the card details link.`,
            entity_type: 'job',
            entity_id: job.id,
            action_url: `/jobs/${job.id}`,
          }))
        )
      }
      await logStep(admin, submissionId!, { step: 'staff_notification', status: 'ok', duration_ms: Date.now() - t_notif })
    } catch (e: any) {
      await logStep(admin, submissionId!, { step: 'staff_notification', status: 'failed', error: e.message, duration_ms: Date.now() - t_notif })
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
