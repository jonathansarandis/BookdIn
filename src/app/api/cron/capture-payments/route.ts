// @ts-nocheck
// src/app/api/cron/capture-payments/route.ts
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

  // Find jobs scheduled tomorrow with an authorized (uncaptured) payment intent
  const { data: jobs, error: queryError } = await supabase
    .from('jobs')
    .select('id, stripe_payment_intent_id, status, payment_status')
    .gte('scheduled_at', tomorrowStart.toISOString())
    .lte('scheduled_at', tomorrowEnd.toISOString())
    .eq('payment_status', 'authorized')
    .not('stripe_payment_intent_id', 'is', null)
    .not('status', 'in', '("cancelled","completed")')

  if (queryError) {
    console.error('[capture-payments] Query failed:', queryError.message)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  console.log(`[capture-payments] ${jobs?.length ?? 0} job(s) to capture`)

  let captured = 0
  let failed = 0
  const errors: { job_id: string; error: string }[] = []

  for (const job of jobs || []) {
    try {
      await stripe.paymentIntents.capture(job.stripe_payment_intent_id)

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      if (updateError) {
        console.error(`[capture-payments] DB update failed for job ${job.id}:`, updateError.message)
      } else {
        console.log(`[capture-payments] Captured job ${job.id} (intent ${job.stripe_payment_intent_id})`)
        captured++
      }
    } catch (err: any) {
      const message = err?.message ?? String(err)
      console.error(`[capture-payments] Stripe capture failed for job ${job.id}:`, message)
      errors.push({ job_id: job.id, error: message })
      failed++

      // Mark as failed so the dashboard surfaces it; don't abort the batch
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

  console.log(`[capture-payments] Done — captured: ${captured}, failed: ${failed}`)

  return NextResponse.json({
    message: 'Capture-payments cron completed',
    timestamp: now.toISOString(),
    jobs_checked: jobs?.length ?? 0,
    captured,
    failed,
    errors,
  })
}
