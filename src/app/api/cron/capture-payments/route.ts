// @ts-nocheck
// src/app/api/cron/capture-payments/route.ts
// Runs daily at 00:00 UTC (≈ 10am AEST / 11am AEDT). Creates and confirms PaymentIntents for all
// jobs scheduled tomorrow (Australia/Melbourne local) with a card on file (payment_status='card_on_file').
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { getChargeableAmount } from '@/lib/pricing'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tomorrow's date range in Australia/Melbourne local time, converted to UTC for SQL filter
  const now = new Date()
  const TZ = 'Australia/Melbourne'
  const nowMelbourne = toZonedTime(now, TZ)

  const tomorrowMelbourneStart = new Date(nowMelbourne)
  tomorrowMelbourneStart.setDate(tomorrowMelbourneStart.getDate() + 1)
  tomorrowMelbourneStart.setHours(0, 0, 0, 0)
  const tomorrowStart = fromZonedTime(tomorrowMelbourneStart, TZ)

  const tomorrowMelbourneEnd = new Date(tomorrowMelbourneStart)
  tomorrowMelbourneEnd.setHours(23, 59, 59, 999)
  const tomorrowEnd = fromZonedTime(tomorrowMelbourneEnd, TZ)

  console.log(`[capture-payments] Running for ${tomorrowStart.toISOString()} – ${tomorrowEnd.toISOString()}`)

  // Find jobs scheduled tomorrow with a card on file ready to charge
  const { data: jobs, error: queryError } = await supabase
    .from('jobs')
    .select(`
      id,
      business_id,
      scheduled_at,
      price_override,
      total_price,
      price,
      stripe_payment_method_id,
      status,
      payment_status,
      customer:customers(full_name, stripe_customer_id),
      service:services(name),
      business:businesses(stripe_account_id, currency, timezone)
    `)
    .gte('scheduled_at', tomorrowStart.toISOString())
    .lte('scheduled_at', tomorrowEnd.toISOString())
    .eq('payment_status', 'card_on_file')
    .not('stripe_payment_method_id', 'is', null)
    .not('stripe_customer_id', 'is', null)
    .not('status', 'in', '("cancelled","completed")')

  if (queryError) {
    console.error('[capture-payments] Query failed:', queryError.message)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  console.log(`[capture-payments] ${jobs?.length ?? 0} job(s) to charge`)

  let captured = 0
  let failed = 0
  const errors: { job_id: string; error: string }[] = []

  for (const job of jobs || []) {
    const stripeAccountId = job.business?.stripe_account_id
    const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    const currency = (job.business?.currency || 'AUD').toLowerCase()

    try {
      // Create and confirm a manual PaymentIntent (pre-auth only — no immediate capture)
      const intent = await stripe.paymentIntents.create(
        {
          amount: getChargeableAmount(job),
          currency,
          customer: job.customer?.stripe_customer_id,
          payment_method: job.stripe_payment_method_id,
          capture_method: 'manual',
          off_session: true,
          confirm: true,
          metadata: { job_id: job.id },
        },
        stripeOpts
      )

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          payment_status: 'authorized',
          stripe_payment_intent_id: intent.id,
        })
        .eq('id', job.id)

      if (updateError) {
        console.error(`[capture-payments] DB update failed for job ${job.id}:`, updateError.message)
      } else {
        console.log(`[capture-payments] Pre-authorized job ${job.id} — intent ${intent.id}`)
        captured++
      }
    } catch (err: any) {
      const message = err?.message ?? String(err)
      console.error(`[capture-payments] Pre-auth failed for job ${job.id}:`, message)
      errors.push({ job_id: job.id, error: message })
      failed++

      try {
        await supabase
          .from('jobs')
          .update({ payment_status: 'auth_failed' })
          .eq('id', job.id)
      } catch (dbErr: any) {
        console.error(`[capture-payments] Could not mark auth_failed for job ${job.id}:`, dbErr?.message)
      }

      try {
        const { data: staff } = await supabase
          .from('profiles')
          .select('id')
          .eq('business_id', job.business_id)

        if (staff?.length) {
          const tz = job.business?.timezone || 'Australia/Melbourne'
          const date = new Date(job.scheduled_at).toLocaleDateString('en-AU', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: tz,
          })
          const customerName = job.customer?.full_name ?? 'Unknown'
          const serviceName = job.service?.name ?? 'Unknown'

          await supabase.from('notifications').insert(
            staff.map((s: { id: string }) => ({
              business_id: job.business_id,
              user_id: s.id,
              type: 'auth_failed',
              title: `Card authorization failed — ${customerName}`,
              body: `Pre-authorization for ${serviceName} on ${date} failed. Check and retry on the booking.`,
              entity_type: 'job',
              entity_id: job.id,
              action_url: `/jobs/${job.id}`,
            }))
          )
        }
      } catch (notifErr: any) {
        console.error(`[capture-payments] auth_failed notification error for job ${job.id}:`, notifErr.message)
      }
    }
  }

  console.log(`[capture-payments] Done — authorized: ${captured}, failed: ${failed}`)

  return NextResponse.json({
    message: 'Capture-payments cron completed',
    timestamp: now.toISOString(),
    jobs_checked: jobs?.length ?? 0,
    captured,
    failed,
    errors,
  })
}
