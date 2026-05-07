// @ts-nocheck
// src/app/api/bookings/public/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendBookingConfirmation } from '@/lib/email'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'

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

  try {
    // 1. Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, slug, logo_url, brand_color, contact_email, timezone, stripe_onboarded, plan, currency, tax_rate, tax_mode, show_tax')
      .eq('id', business_id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // 2. Get service details (with room_pricing for server-side recalculation)
    const { data: service } = await supabase
      .from('services')
      .select('*, room_pricing(*)')
      .eq('id', service_id)
      .single()

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // 2a. Frequency discount: DB first, hardcoded fallback
    const { data: freqRow } = await supabase
      .from('frequency_discounts')
      .select('discount_percent')
      .eq('service_id', service_id)
      .eq('frequency', frequency)
      .single()
    const discountPct = freqRow?.discount_percent ?? HARDCODED_DISCOUNTS[frequency] ?? 0

    // 2b. Fetch extras early (tightened: service_id + business_id prevents cross-tenant/cross-service borrowing)
    let extraDetails: any[] = []
    if (extras?.length > 0) {
      const { data } = await supabase
        .from('service_extras')
        .select('*')
        .in('id', extras)
        .eq('service_id', service_id)
        .eq('business_id', business_id)
      extraDetails = data || []
    }

    // 2c. Server-side price recalculation
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

    // 2d. Mismatch check: ±1 cent tolerance
    if (Math.abs(taxSplit.total - clientTotal) > 1) {
      return NextResponse.json(
        { error: 'Pricing mismatch — please refresh and try again' },
        { status: 400 },
      )
    }

    // 3. Create or find customer
    let customerId: string
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

    // 4. Create address
    const { data: addr } = await supabase
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

    // 5. Create job (pending status — no card yet)
    const scheduledAt = new Date(`${scheduled_date}T${effectiveTime}:00`)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        business_id,
        customer_id: customerId,
        address_id: addr?.id,
        service_id,
        status: 'pending',
        scheduled_at: scheduledAt.toISOString(),
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

    if (jobError) throw new Error('Failed to create job')

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

    // 7. Create CRM contact
    const now = new Date()
    const isPM = now.getHours() >= 14

    // Follow up: same day if before 2pm, next day 9am if after 2pm
    const followupDate = new Date()
    if (isPM) {
      followupDate.setDate(followupDate.getDate() + 1)
      followupDate.setHours(9, 0, 0, 0)
    } else {
      followupDate.setHours(15, 0, 0, 0) // 3pm same day
    }

    const { data: crmContact } = await supabase
      .from('crm_contacts')
      .insert({
        business_id,
        customer_id: customerId,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone || null,
        source: 'website',
        stage: 'lead',
        notes: `Online booking for ${service?.name} on ${formatDate(scheduled_date)}`,
        last_activity_at: now.toISOString(),
        next_followup_at: followupDate.toISOString(),
      })
      .select('id')
      .single()

    // 8. Log CRM activity
    if (crmContact) {
      await supabase.from('crm_activities').insert({
        business_id,
        contact_id: crmContact.id,
        type: 'note',
        title: 'Online booking submitted',
        body: `Booked ${service?.name} for ${formatDate(scheduled_date)} at ${formatTime(scheduled_time)}. Total: $${(taxSplit.total / 100).toFixed(2)}`,
      })
    }

    // 9. Get all staff to notify
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('business_id', business_id)

    // 10. Create in-app notifications for all staff
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

      // 11. Send email notification to staff
      for (const staff of staffProfiles) {
        if (staff.email) {
          await resend.emails.send({
            from: `BookdIn <hello@bookdin.co>`,
            to: staff.email,
            subject: `📞 New booking — call ${customer.full_name} now`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <h2 style="color: ${business.brand_color || '#1A6B4A'};">New online booking received</h2>
                <p>A new booking has come in and requires a confirmation call.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Customer</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">${customer.full_name}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px; font-size: 14px;"><a href="tel:${customer.phone}">${customer.phone}</a></td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px; font-size: 14px;">${customer.email}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Service</td><td style="padding: 8px; font-size: 14px;">${service?.name}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px; font-size: 14px;">${formatDate(scheduled_date)} at ${formatTime(scheduled_time)}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Total</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">$${(taxSplit.total / 100).toFixed(2)}</td></tr>
                </table>
                <p style="color: #dc2626; font-weight: 600;">Action required: Call the customer now to confirm the booking and remind them to complete the secure card details link in their email.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/${job.id}" style="display: inline-block; background: ${business.brand_color || '#1A6B4A'}; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin-top: 8px;">View booking →</a>
              </div>
            `,
          }).catch(console.error)
        }
      }
    }

    // 12. Send confirmation email to customer
    const cardSetupUrl = business.stripe_onboarded
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${job.id}/card-setup`
      : undefined

    await sendBookingConfirmation({
      job: {
        id: job.id,
        scheduled_at: scheduledAt.toISOString(),
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
        timezone: business.timezone,
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
    })


    // Save lead source attribution
    if (utm_data) {
      await supabase.from('lead_sources').insert({
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
      }).catch(console.error)
    }
    return NextResponse.json({ success: true, job_id: job.id })
  } catch (err: any) {
    console.error('Public booking error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
