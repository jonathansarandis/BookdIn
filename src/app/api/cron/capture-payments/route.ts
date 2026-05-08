// @ts-nocheck
// src/app/api/cron/capture-payments/route.ts
// Runs daily at 12:00 UTC (vercel.json). Creates and confirms PaymentIntents for all
// jobs scheduled tomorrow that have a card on file (payment_status='card_on_file').
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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

  // Tomorrow's date range in UTC
  const now = new Date()
  const tomorrowStart = new Date(now)
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)
  tomorrowStart.setUTCHours(0, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setUTCHours(23, 59, 59, 999)

  console.log(`[capture-payments] Running for ${tomorrowStart.toISOString()} – ${tomorrowEnd.toISOString()}`)

  // Find jobs scheduled tomorrow with a card on file ready to charge
  const { data: jobs, error: queryError } = await supabase
    .from('jobs')
    .select(`
      id,
      total_price,
      stripe_payment_method_id,
      stripe_customer_id,
      status,
      payment_status,
      business:businesses(stripe_account_id, currency)
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
      // Create and immediately confirm the PaymentIntent off-session
      const intent = await stripe.paymentIntents.create(
        {
          amount: job.total_price,
          currency,
          customer: job.stripe_customer_id,
          payment_method: job.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { job_id: job.id },
        },
        stripeOpts
      )

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: intent.id,
        })
        .eq('id', job.id)

      if (updateError) {
        console.error(`[capture-payments] DB update failed for job ${job.id}:`, updateError.message)
      } else {
        console.log(`[capture-payments] Charged job ${job.id} — intent ${intent.id}`)
        captured++
      }
    } catch (err: any) {
      const message = err?.message ?? String(err)
      console.error(`[capture-payments] Charge failed for job ${job.id}:`, message)
      errors.push({ job_id: job.id, error: message })
      failed++

      try {
        await supabase
          .from('jobs')
          .update({ payment_status: 'capture_failed' })
          .eq('id', job.id)
      } catch (dbErr: any) {
        console.error(`[capture-payments] Could not mark capture_failed for job ${job.id}:`, dbErr?.message)
      }
    }
  }

  console.log(`[capture-payments] Done — charged: ${captured}, failed: ${failed}`)

  return NextResponse.json({
    message: 'Capture-payments cron completed',
    timestamp: now.toISOString(),
    jobs_checked: jobs?.length ?? 0,
    captured,
    failed,
    errors,
  })
}
