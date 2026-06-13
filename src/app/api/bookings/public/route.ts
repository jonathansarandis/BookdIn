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
    attribution: bodyAttribution,
    bedrooms,
    bathrooms,
  } = body
  const isFlexible = scheduled_time === 'flexible'
  const effectiveTime = isFlexible ? '09:00' : scheduled_time
  const HARDCODED_DISCOUNTS: Record<string, number> = { weekly: 5, fortnightly: 10, monthly: 10 }

  // Cookie read — fallback only; payload attribution is primary
  let cookieGclid: string | null = null
  let cookieGbraid: string | null = null
  let cookieWbraid: string | null = null
  const attributionCookie = request.cookies.get('bookdin_attribution')?.value
  try {
    if (attributionCookie) {
      const parsed = JSON.parse(decodeURIComponent(attributionCookie))
      cookieGclid  = parsed.gclid  || null
      cookieGbraid = parsed.gbraid || null
      cookieWbraid = parsed.wbraid || null
    }
  } catch { /* malformed cookie — ignore */ }

  // Payload attribution is primary; cookie is fallback when payload value is absent
  const gclid  = bodyAttribution?.gclid  ?? cookieGclid  ?? null
  const gbraid = bodyAttribution?.gbraid ?? cookieGbraid ?? null
  const wbraid = bodyAttribution?.wbraid ?? cookieWbraid ?? null

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

    // 2a. Frequency discount: DB first, hardcoded fallback.
    // Server enforces one_time for non-recurring services regardless of client payload.
    const effectiveFrequency = service.allows_recurring === false ? 'one_time' : frequency
    const { data: freqRow } = await supabase
      .from('frequency_discounts')
      .select('discount_percent')
      .eq('service_id', service_id)
      .eq('frequency', effectiveFrequency)
      .single()
    const discountPct = service.frequency_discount_eligible
      ? (freqRow?.discount_percent ?? HARDCODED_DISCOUNTS[effectiveFrequency] ?? 0)
      : 0

    // 2b. Fetch extras early — three-layer price resolution:
    //   location_extras.price ?? service_extras.price_override ?? extras.default_price
    //   Extras must be (a) enabled for this location and (b) mapped to this service.
    let extraDetails: any[] = []
    if (extras?.length > 0) {
      const extraIds: string[] = extras.map((e: any) => e.id)
      const extrasQtyMap: Record<string, number> = {}
      for (const e of extras) extrasQtyMap[e.id] = e.quantity ?? 1

      const [{ data: locExtRows }, { data: extRows }, { data: svcExtRows }] = await Promise.all([
        supabase
          .from('location_extras')
          .select('extra_id, price')
          .eq('location_id', location.id)
          .in('extra_id', extraIds)
          .eq('is_enabled', true),
        supabase
          .from('extras')
          .select('id, name, default_price, is_quote_only')
          .in('id', extraIds)
          .eq('business_id', business_id),
        supabase
          .from('service_extras')
          .select('extra_id, price_override')
          .eq('service_id', service_id)
          .in('extra_id', extraIds),
      ])

      const locPriceMap: Record<string, number | null> = {}
      for (const r of locExtRows || []) locPriceMap[r.extra_id] = r.price ?? null

      const svcOverrideMap: Record<string, number | null> = {}
      for (const r of svcExtRows || []) svcOverrideMap[r.extra_id] = r.price_override ?? null

      const enabledExtraIds = new Set((locExtRows || []).map((r: any) => r.extra_id))
      const serviceExtraIds = new Set((svcExtRows || []).map((r: any) => r.extra_id))

      extraDetails = (extRows || [])
        .filter((ex: any) => enabledExtraIds.has(ex.id) && serviceExtraIds.has(ex.id))
        .map((ex: any) => ({
          id: ex.id,
          name: ex.name,
          price: locPriceMap[ex.id] ?? svcOverrideMap[ex.id] ?? ex.default_price,
          is_quote_only: ex.is_quote_only,
          quantity: extrasQtyMap[ex.id] ?? 1,
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
      selectedExtras: extraDetails.map(ex => ({ price: ex.price, is_quote_only: ex.is_quote_only, quantity: ex.quantity })),
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
        .select('id, gclid, gbraid, wbraid')
        .eq('business_id', business_id)
        .eq('email', customer.email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
        // Per-field update: only write non-null new values; null incoming = preserve existing
        const updates: Record<string, string> = {}
        if (gclid)  updates.gclid  = gclid
        if (gbraid) updates.gbraid = gbraid
        if (wbraid) updates.wbraid = wbraid
        const willUpdate = Object.keys(updates).length > 0
        if (willUpdate) {
          const { error: gclidUpdateError } = await supabase.from('customers').update(updates).eq('id', existingCustomer.id)
          if (gclidUpdateError) console.error('[public booking] gclid update failed:', gclidUpdateError.message)
        }
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            business_id,
            full_name: customer.full_name,
            email: customer.email,
            phone: customer.phone || null,
            gclid,
            gbraid,
            wbraid,
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
        frequency: effectiveFrequency,
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
          price: ex.is_quote_only ? 0 : ex.price,
          quantity: ex.quantity ?? 1,
        }))
      )
    }

    // Capture for closure use in after()
    const cardSetupUrl = business.stripe_charges_enabled
      ? `${process.env.NEXT_PUBLIC_APP_URL}/secure-card/${cardSetupToken}`
      : undefined

    // Side effects: parallel, each isolated by its own try/catch + logStep
    await Promise.allSettled([
      (async () => {
        // 7-8. CRM: upsert contact and log activity (non-critical)
        const t_crm = Date.now()
        try {
          const { upsertCrmContact, logCrmActivity } = await import('@/lib/crm/upsert')
          const crmResult = await upsertCrmContact(supabase, {
            business_id,
            customer_id: customerId,
            full_name: customer.full_name,
            email: customer.email,
            phone: customer.phone || null,
            source: 'website',
          })
          if (crmResult.contact_id) {
            await logCrmActivity(supabase, {
              business_id,
              contact_id: crmResult.contact_id,
              type: 'note',
              title: crmResult.created ? 'Online booking submitted (new lead)' : 'Repeat online booking',
              body: `Booked ${service?.name} for ${formatDate(scheduled_date)} at ${formatTime(scheduled_time)}. Total: $${(taxSplit.total / 100).toFixed(2)}`,
            })
          } else if (crmResult.error) {
            console.error('[public booking] CRM upsert failed (non-blocking):', crmResult.error)
          }
          await logStep(supabase, submissionId!, { step: 'crm_upsert', status: 'ok', duration_ms: Date.now() - t_crm })
        } catch (e: any) {
          await logStep(supabase, submissionId!, { step: 'crm_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_crm })
        }
      })(),

      (async () => {
        // 9-10. Staff in-app notifications (non-critical)
        const t_notif = Date.now()
        try {
          const { data: staffProfiles } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .eq('business_id', business_id)

          if (staffProfiles?.length) {
            await supabase.from('notifications').insert(
              staffProfiles.map(staff => ({
                business_id,
                user_id: staff.id,
                type: 'call_prompt',
                title: `📞 Call ${customer.full_name} to confirm booking`,
                body: `New online booking for ${service?.name} on ${formatDate(scheduled_date)}. Call to confirm and ensure they complete the card details link.`,
                entity_type: 'job',
                entity_id: job.id,
                action_url: `/jobs/${job.id}`,
              }))
            )
          }
          await logStep(supabase, submissionId!, { step: 'staff_notification', status: 'ok', duration_ms: Date.now() - t_notif })
        } catch (e: any) {
          await logStep(supabase, submissionId!, { step: 'staff_notification', status: 'failed', error: e.message, duration_ms: Date.now() - t_notif })
        }
      })(),

      (async () => {
        // 12. Send confirmation email to customer (non-critical)
        let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
        const t_email = Date.now()
        try {
          const result = await sendBookingConfirmation({
            job: {
              id: job.id,
              scheduled_at: scheduledAtIso,
              total_price: taxSplit.total,
              tax_amount: taxSplit.tax,
              is_flexible_time: isFlexible,
            },
            customer: { full_name: customer.full_name, email: customer.email },
            business: {
              name: business.name,
              brand_color: business.brand_color,
              logo_url: business.logo_url,
              contact_email: business.contact_email,
              timezone: tz,
              plan: business.plan,
              currency: business.currency,
            },
            address: {
              line1: address.line1,
              city: address.city,
              state: address.state,
              postcode: address.postcode,
            },
            service: { name: service?.name || 'Service' },
            cardSetupUrl,
            business_id: business_id,
          })
          emailStatus = result.success ? 'sent' : 'failed'
          if (result.success) {
            await supabase
              .from('jobs')
              .update({ confirmation_email_sent_at: new Date().toISOString() })
              .eq('id', job.id)
          }
          await logStep(supabase, submissionId!, { step: 'customer_email', status: emailStatus === 'failed' ? 'failed' : 'ok', duration_ms: Date.now() - t_email })
        } catch (e: any) {
          emailStatus = 'failed'
          await logStep(supabase, submissionId!, { step: 'customer_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_email })
        }
      })(),

      (async () => {
        // 13. Send owner notification email (non-critical)
        const t_owner_email = Date.now()
        try {
          if (!business.contact_email) {
            await logStep(supabase, submissionId!, { step: 'owner_email', status: 'failed', error: 'no contact_email configured', duration_ms: Date.now() - t_owner_email })
          } else {
            const frequencyLabel = frequency ? (({ one_time: 'One Time', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' } as Record<string, string>)[frequency] || frequency) : null
            const { error: ownerEmailErr } = await resend.emails.send({
              from: `BookdIn <hello@bookdin.co>`,
              to: business.contact_email,
              bcc: 'jonathan.sarandis@gmail.com',
              reply_to: customer.email,
              subject: `📞 New booking — call ${customer.full_name} now`,
              html: `
            <div style="margin: 0; padding: 40px 20px; background: #f5f3ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 48px 40px; text-align: center;">
                <div style="margin: 0 0 40px 0;"><div style="display: inline-block; background: #0a1228; padding: 12px 24px; border-radius: 10px; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;"><span style="color: #ffffff;">Bookd</span><span style="color: #2563EB;">In</span></div></div>
                <h1 style="font-size: 28px; font-weight: 700; color: #0a1929; margin: 0 0 24px 0;">New Booking</h1>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 40px 0;">You have a new booking from <strong>${customer.full_name}</strong></p>
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px 0;">${customer.phone ? `<a href="tel:${customer.phone}" style="color: ${business.brand_color || '#1E9BFF'}; text-decoration: none;">${customer.phone}</a> &middot; ` : ''}<a href="mailto:${customer.email}" style="color: ${business.brand_color || '#1E9BFF'}; text-decoration: none;">${customer.email}</a></p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${formatDate(scheduled_date)}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${isFlexible ? 'Flexible time' : formatTime(scheduled_time)}</p>
                ${frequencyLabel ? `<p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${frequencyLabel}</p>` : ''}
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${address.line1}, ${address.city} ${address.state} ${address.postcode}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${service?.name}</p>
                <p style="font-size: 18px; font-weight: 700; color: #0a1929; margin: 8px 0 32px 0;"><strong>Total: $${(taxSplit.total / 100).toFixed(2)}</strong></p>
                <p style="font-size: 14px; color: #dc2626; font-weight: 500; margin: 0 0 40px 0; line-height: 1.6;"><strong>Action required:</strong> Call the customer now to confirm the booking and remind them to complete the secure card details link in their email.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/${job.id}" style="display: inline-block; background: ${business.brand_color || '#1E9BFF'}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">View booking →</a>
              </div>
            </div>
          `,
            })
            await logStep(supabase, submissionId!, {
              step: 'owner_email',
              status: ownerEmailErr ? 'failed' : 'ok',
              duration_ms: Date.now() - t_owner_email,
              ...(ownerEmailErr ? { error: String(ownerEmailErr) } : {}),
            })
          }
        } catch (e: any) {
          await logStep(supabase, submissionId!, { step: 'owner_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_owner_email })
        }
      })(),

      (async () => {
        // 14. Send confirmation SMS to customer (non-critical)
        const t_sms = Date.now()
        try {
          const { sendDialpadSms } = await import('@/lib/sms/dialpad')
          const { formatDateForSms, formatTimeForSms } = await import('@/lib/sms/format')

          const smsResult = await sendDialpadSms({
            business: {
              sms_provider: business.sms_provider,
              sms_api_key_encrypted: business.sms_api_key_encrypted,
              sms_api_key_iv: business.sms_api_key_iv,
              sms_user_id: business.sms_user_id,
              sms_template: business.sms_template,
              sms_enabled: business.sms_enabled,
            },
            toPhone: customer.phone || '',
            vars: {
              customer_name: customer.full_name?.split(' ')[0] || customer.full_name || '',
              service_name: service?.name || 'Service',
              date: formatDateForSms(scheduledAtIso, tz),
              time: formatTimeForSms(scheduledAtIso, tz, isFlexible),
              business_name: business.name,
              business_phone: business.phone || '',
              customer_id: customer.id || customerId || undefined,
              customer_first_name: customer.full_name?.split(' ')[0] || customer.full_name || '',
              customer_last_name: customer.full_name?.split(' ').slice(1).join(' ') || undefined,
              customer_email: customer.email || undefined,
            },
          })

          const updates: Record<string, any> = { sms_status: smsResult.status }
          if (smsResult.error) updates.sms_error = smsResult.error.slice(0, 500)
          if (smsResult.status === 'sent') updates.sms_sent_at = new Date().toISOString()

          const { error: updateError } = await supabase.from('jobs').update(updates).eq('id', job.id)
          if (updateError) console.error('Failed to persist SMS audit:', updateError)

          if (smsResult.status === 'failed') {
            console.error('SMS failed:', smsResult.error, 'job:', job.id)
          } else if (smsResult.status === 'skipped') {
            console.log('SMS skipped:', smsResult.error, 'job:', job.id)
          } else {
            console.log('SMS sent:', smsResult.message_id, 'job:', job.id)
          }
          await logStep(supabase, submissionId!, { step: 'sms', status: 'ok', duration_ms: Date.now() - t_sms })
        } catch (e: any) {
          console.error('SMS handler threw (booking still successful):', e)
          try {
            await supabase.from('jobs').update({
              sms_status: 'failed',
              sms_error: `handler threw: ${e.message?.slice(0, 400)}`,
            }).eq('id', job.id)
          } catch { /* best-effort audit */ }
          await logStep(supabase, submissionId!, { step: 'sms', status: 'failed', error: e.message, duration_ms: Date.now() - t_sms })
        }
      })(),

      (async () => {
        // Save lead source attribution
        if (utm_data) {
          try {
            const { error: leadError } = await supabase.from('lead_sources').insert({
              booking_id: job.id,
              business_id,
              customer_id: customerId,
              utm_source: utm_data.utm_source,
              utm_medium: utm_data.utm_medium,
              utm_campaign: utm_data.utm_campaign,
              utm_ad_group: utm_data.utm_ad_group,
              utm_term: utm_data.utm_term,
              utm_content: utm_data.utm_content,
              gclid: utm_data.gclid,
              referrer_url: utm_data.referrer_url,
              landing_page: utm_data.landing_page,
              source_type: utm_data.source_type || 'direct',
              session_id: utm_data.session_id,
              booking_value_cents: taxSplit.total,
              lead_status: 'booked',
              converted_at: new Date().toISOString(),
            })
            if (leadError) console.error('Lead source insert failed:', leadError)
          } catch (err) {
            console.error('Lead source insert threw:', err)
          }
        }
      })(),

      (async () => {
        // Same-day booking notification — fires only when scheduled_at is today in Melbourne time
        try {
          const jobDateMelbourne = new Intl.DateTimeFormat('en-AU', {
            timeZone: tz || 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(new Date(scheduledAtIso))
          const todayMelbourne = new Intl.DateTimeFormat('en-AU', {
            timeZone: tz || 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(new Date())

          if (jobDateMelbourne === todayMelbourne) {
            const { data: staffProfiles } = await supabase
              .from('profiles')
              .select('id')
              .eq('business_id', business_id)

            if (staffProfiles?.length) {
              const dateLabel = new Date(scheduledAtIso).toLocaleDateString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric', timeZone: tz,
              })
              await supabase.from('notifications').insert(
                staffProfiles.map((staff: { id: string }) => ({
                  business_id,
                  user_id: staff.id,
                  type: 'same_day_booking_created',
                  title: `Same-day booking — ${customer.full_name}`,
                  body: `New booking created for today (${dateLabel}). Card setup pending.`,
                  entity_type: 'job',
                  entity_id: job.id,
                  action_url: `/jobs/${job.id}`,
                }))
              )
            }
          }
        } catch (e: any) {
          console.error('[public booking] same_day_booking_created notification failed (non-blocking):', e.message)
        }
      })(),
    ])

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
