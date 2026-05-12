// @ts-nocheck
// src/app/api/bookings/dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendBookingConfirmation } from '@/lib/email'
import { logStep } from '@/lib/bookings/submissionStore'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

function formatDateFromIso(isoStr: string, tz: string) {
  return new Date(isoStr).toLocaleDateString('en-AU', {
    timeZone: tz,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTimeFromIso(isoStr: string, tz: string) {
  return new Date(isoStr).toLocaleTimeString('en-AU', {
    timeZone: tz,
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { job_id, submission_id } = body

  if (!job_id) return NextResponse.json({ error: 'job_id is required' }, { status: 400 })

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select(`
      id, business_id, location_id, service_id, customer_id, address_id,
      scheduled_at, total_price, tax_amount, is_flexible_time, frequency,
      custom_field_values, tnc_accepted_at, tnc_url_at_acceptance,
      customer:customers (id, full_name, email, phone),
      service:services (id, name),
      business:businesses (id, name, brand_color, logo_url, contact_email, timezone, plan, currency, sms_provider, sms_api_key_encrypted, sms_api_key_iv, sms_user_id, sms_template, sms_enabled, stripe_charges_enabled, phone),
      address:addresses (line1, city, state, postcode)
    `)
    .eq('id', job_id)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const business = job.business
  const customer = job.customer
  const service = job.service
  const address = job.address
  const business_id = job.business_id
  const customerId = job.customer_id

  const tz = business.timezone || 'Australia/Melbourne'
  const scheduledAtIso = job.scheduled_at
  const isFlexible = job.is_flexible_time
  const frequencyLabel = (({ one_time: 'One Time', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' } as Record<string, string>)[job.frequency]) || job.frequency

  const sid = submission_id ?? null

  await Promise.allSettled([
    (async () => {
      // CRM: upsert contact and log activity (non-critical)
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
            body: `Booked ${service?.name} for ${formatDateFromIso(scheduledAtIso, tz)} at ${formatTimeFromIso(scheduledAtIso, tz)}. Total: $${(job.total_price / 100).toFixed(2)}`,
          })
        } else if (crmResult.error) {
          console.error('[dispatch] CRM upsert failed (non-blocking):', crmResult.error)
        }
        if (sid) await logStep(supabase, sid, { step: 'crm_upsert', status: 'ok', duration_ms: Date.now() - t_crm })
      } catch (e: any) {
        if (sid) await logStep(supabase, sid, { step: 'crm_upsert', status: 'failed', error: e.message, duration_ms: Date.now() - t_crm })
      }
    })(),

    (async () => {
      // Staff in-app notifications (non-critical)
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
              body: `New online booking for ${service?.name} on ${formatDateFromIso(scheduledAtIso, tz)}. Call to confirm and ensure they complete the card details link.`,
              entity_type: 'job',
              entity_id: job.id,
              action_url: `/jobs/${job.id}`,
            }))
          )
        }
        if (sid) await logStep(supabase, sid, { step: 'staff_notification', status: 'ok', duration_ms: Date.now() - t_notif })
      } catch (e: any) {
        if (sid) await logStep(supabase, sid, { step: 'staff_notification', status: 'failed', error: e.message, duration_ms: Date.now() - t_notif })
      }
    })(),

    (async () => {
      // Send confirmation email to customer (non-critical)
      const t_email = Date.now()
      try {
        await sendBookingConfirmation({
          job: {
            id: job.id,
            scheduled_at: scheduledAtIso,
            total_price: job.total_price,
            tax_amount: job.tax_amount,
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
          cardSetupUrl: undefined, // D3: wire through card_setup_token
          business_id,
        })
        if (sid) await logStep(supabase, sid, { step: 'customer_email', status: 'ok', duration_ms: Date.now() - t_email })
      } catch (e: any) {
        if (sid) await logStep(supabase, sid, { step: 'customer_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_email })
      }
    })(),

    (async () => {
      // Send owner notification email (non-critical)
      const t_owner_email = Date.now()
      try {
        if (!business.contact_email) {
          if (sid) await logStep(supabase, sid, { step: 'owner_email', status: 'failed', error: 'no contact_email configured', duration_ms: Date.now() - t_owner_email })
        } else {
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
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${formatDateFromIso(scheduledAtIso, tz)}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${isFlexible ? 'Flexible time' : formatTimeFromIso(scheduledAtIso, tz)}</p>
                ${frequencyLabel ? `<p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${frequencyLabel}</p>` : ''}
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${address.line1}, ${address.city} ${address.state} ${address.postcode}</p>
                <p style="font-size: 16px; color: #4b5563; margin: 0 0 24px 0;">${service?.name}</p>
                <p style="font-size: 18px; font-weight: 700; color: #0a1929; margin: 8px 0 32px 0;"><strong>Total: $${(job.total_price / 100).toFixed(2)}</strong></p>
                <p style="font-size: 14px; color: #dc2626; font-weight: 500; margin: 0 0 40px 0; line-height: 1.6;"><strong>Action required:</strong> Call the customer now to confirm the booking and remind them to complete the secure card details link in their email.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/${job.id}" style="display: inline-block; background: ${business.brand_color || '#1E9BFF'}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">View booking →</a>
              </div>
            </div>
          `,
          })
          if (sid) await logStep(supabase, sid, {
            step: 'owner_email',
            status: ownerEmailErr ? 'failed' : 'ok',
            duration_ms: Date.now() - t_owner_email,
            ...(ownerEmailErr ? { error: String(ownerEmailErr) } : {}),
          })
        }
      } catch (e: any) {
        if (sid) await logStep(supabase, sid, { step: 'owner_email', status: 'failed', error: e.message, duration_ms: Date.now() - t_owner_email })
      }
    })(),

    (async () => {
      // Send confirmation SMS to customer (non-critical)
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
        if (sid) await logStep(supabase, sid, { step: 'sms', status: 'ok', duration_ms: Date.now() - t_sms })
      } catch (e: any) {
        console.error('SMS handler threw (dispatch):', e)
        try {
          await supabase.from('jobs').update({
            sms_status: 'failed',
            sms_error: `handler threw: ${e.message?.slice(0, 400)}`,
          }).eq('id', job.id)
        } catch { /* best-effort audit */ }
        if (sid) await logStep(supabase, sid, { step: 'sms', status: 'failed', error: e.message, duration_ms: Date.now() - t_sms })
      }
    })(),
  ])

  return NextResponse.json({ ok: true, job_id })
}
