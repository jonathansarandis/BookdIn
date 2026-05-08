// @ts-nocheck
// POST /api/jobs/[id]/charge — requires authenticated session
// Captures an authorized (manual) PaymentIntent created by the capture-payments cron.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let amountToCapture: number | undefined
  try {
    const body = await request.json()
    if (body.amountToCapture !== undefined) amountToCapture = Number(body.amountToCapture)
  } catch {
    // no body — full capture
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      payment_status,
      stripe_payment_intent_id,
      business:businesses(stripe_account_id)
    `)
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.payment_status !== 'authorized') {
    return NextResponse.json(
      { error: `Cannot capture — payment status is '${job.payment_status}'` },
      { status: 409 }
    )
  }

  if (!job.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No PaymentIntent on record' }, { status: 409 })
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

  let intent: Stripe.PaymentIntent
  try {
    const captureParams: Stripe.PaymentIntentCaptureParams = {}
    if (amountToCapture !== undefined) captureParams.amount_to_capture = amountToCapture
    intent = await stripe.paymentIntents.capture(
      job.stripe_payment_intent_id,
      captureParams,
      stripeOpts
    )
  } catch (err: any) {
    console.error(`[charge] Stripe capture failed for job ${params.id}:`, err.message)
    return NextResponse.json({ error: err.message || 'Capture failed' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      final_charged_amount: intent.amount_received,
    })
    .eq('id', params.id)

  if (updateError) {
    console.error(`[charge] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json(
      { error: 'Capture succeeded but DB update failed — contact support' },
      { status: 500 }
    )
  }

  console.log(`[charge] Captured job ${params.id} — intent ${intent.id}, received ${intent.amount_received}`)
  return NextResponse.json({ success: true, amount_received: intent.amount_received })
}
