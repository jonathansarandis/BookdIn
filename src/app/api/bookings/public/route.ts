// @ts-nocheck
// src/app/api/bookings/public/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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
    total_price,
    extras,
    customer,
    address,
    customer_notes,
  } = body

  try {
    // 1. Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // 2. Get service details
    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single()

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
    const scheduledAt = new Date(`${scheduled_date}T${scheduled_time}:00`)
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
        price: total_price,
        total_price,
        tax_amount: 0,
        frequency,
        customer_notes: customer_notes || null,
        payment_status: 'unpaid',
        payment_method: 'card',
        booking_source: 'online',
      })
      .select('id')
      .single()

    if (jobError) throw new Error('Failed to create job')

    // 6. Insert extras
    if (extras?.length > 0) {
      const { data: extraDetails } = await supabase
        .from('service_extras')
        .select('*')
        .in('id', extras)

      if (extraDetails?.length) {
        await supabase.from('job_extras').insert(
          extraDetails.map(ex => ({
            job_id: job.id,
            extra_id: ex.id,
            name: ex.name,
            price: ex.price,
          }))
        )
      }
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
        body: `Booked ${service?.name} for ${formatDate(scheduled_date)} at ${formatTime(scheduled_time)}. Total: $${(total_price / 100).toFixed(2)}`,
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
            from: `BookdIn <info@cleanfreaks.au>`,
            to: staff.email,
            subject: `📞 New booking — call ${customer.full_name} now`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #166534;">New online booking received</h2>
                <p>A new booking has come in and requires a confirmation call.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Customer</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">${customer.full_name}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px; font-size: 14px;"><a href="tel:${customer.phone}">${customer.phone}</a></td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px; font-size: 14px;">${customer.email}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Service</td><td style="padding: 8px; font-size: 14px;">${service?.name}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Date</td><td style="padding: 8px; font-size: 14px;">${formatDate(scheduled_date)} at ${formatTime(scheduled_time)}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280; font-size: 14px;">Total</td><td style="padding: 8px; font-size: 14px; font-weight: 600;">$${(total_price / 100).toFixed(2)}</td></tr>
                </table>
                <p style="color: #dc2626; font-weight: 600;">Action required: Call the customer now to confirm the booking and remind them to complete the secure card details link in their email.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/jobs/${job.id}" style="display: inline-block; background: #166534; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin-top: 8px;">View booking →</a>
              </div>
            `,
          }).catch(console.error)
        }
      }
    }

    // 12. Send confirmation email to customer with Stripe card save link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    const cardSaveUrl = `${appUrl}/api/bookings/${job.id}/card-setup`

    await resend.emails.send({
      from: `${business.name} <info@cleanfreaks.au>`,
      reply_to: staffProfiles?.[0]?.email,
      to: customer.email,
      subject: `Booking confirmed — ${service?.name} on ${formatDate(scheduled_date)}`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <tr>
          <td style="background-color: #166534; padding: 32px 40px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">${business.name}</h1>
            <p style="margin: 8px 0 0; color: #bbf7d0; font-size: 14px;">Booking confirmation</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px;">
            <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">Hi ${customer.full_name.split(' ')[0]},</p>
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px; line-height: 1.6;">
              Thanks for booking with us! We've received your request and will be in touch shortly to confirm.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <tr><td style="padding: 6px 0;"><table width="100%"><tr>
                <td style="color: #6b7280; font-size: 14px;">Service</td>
                <td style="text-align: right; color: #111827; font-size: 14px; font-weight: 600;">${service?.name}</td>
              </tr></table></td></tr>
              <tr><td style="padding: 6px 0; border-top: 1px solid #e5e7eb;"><table width="100%"><tr>
                <td style="color: #6b7280; font-size: 14px;">Date</td>
                <td style="text-align: right; color: #111827; font-size: 14px;">${formatDate(scheduled_date)}</td>
              </tr></table></td></tr>
              <tr><td style="padding: 6px 0; border-top: 1px solid #e5e7eb;"><table width="100%"><tr>
                <td style="color: #6b7280; font-size: 14px;">Time</td>
                <td style="text-align: right; color: #111827; font-size: 14px;">${formatTime(scheduled_time)}</td>
              </tr></table></td></tr>
              <tr><td style="padding: 6px 0; border-top: 1px solid #e5e7eb;"><table width="100%"><tr>
                <td style="color: #6b7280; font-size: 14px;">Address</td>
                <td style="text-align: right; color: #111827; font-size: 14px;">${address.line1}, ${address.city} ${address.state}</td>
              </tr></table></td></tr>
              <tr><td style="padding: 6px 0; border-top: 2px solid #111827;"><table width="100%"><tr>
                <td style="color: #111827; font-size: 15px; font-weight: 700;">Total</td>
                <td style="text-align: right; color: #111827; font-size: 18px; font-weight: 700;">$${(total_price / 100).toFixed(2)}</td>
              </tr></table></td></tr>
            </table>

            <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; color: #854d0e; font-size: 15px; font-weight: 600;">Action required: Save your card details</p>
              <p style="margin: 0 0 16px; color: #92400e; font-size: 14px; line-height: 1.6;">
                To secure your booking, please add your card details using our secure payment link below. Your card won't be charged until after your service is complete.
              </p>
              <a href="${cardSaveUrl}" style="display: inline-block; background-color: #166534; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Save card details securely →
              </a>
            </div>

            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
              If you have any questions, simply reply to this email. We look forward to seeing you!
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
              ${business.name} · Powered by BookdIn
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    }).catch(console.error)

    return NextResponse.json({ success: true, job_id: job.id })
  } catch (err: any) {
    console.error('Public booking error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
