// @ts-nocheck
import { NextResponse } from 'next/server'
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
  _req: Request,
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

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      payment_status,
      total_price,
      stripe_payment_method_id,
      stripe_customer_id,
      business:businesses(stripe_account_id, currency)
    `)
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (!['card_on_file', 'auth_failed'].includes(job.payment_status)) {
    return NextResponse.json(
      { error: `Cannot pre-authorize — payment status is '${job.payment_status}'` },
      { status: 409 }
    )
  }

  if (!job.stripe_payment_method_id || !job.stripe_customer_id) {
    return NextResponse.json({ error: 'No card on file' }, { status: 409 })
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  const currency = (job.business?.currency || 'aud').toLowerCase()

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create({
      amount: job.total_price,
      currency,
      customer: job.stripe_customer_id,
      payment_method: job.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      capture_method: 'manual',
      metadata: { jobId: job.id },
    }, stripeOpts)
  } catch (err: any) {
    console.error(`[preauthorize] Stripe failed for job ${params.id}:`, err.message)
    return NextResponse.json({ error: err.message || 'Pre-authorization failed' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      payment_status: 'authorized',
      stripe_payment_intent_id: intent.id,
    })
    .eq('id', params.id)

  if (updateError) {
    console.error(`[preauthorize] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json(
      { error: 'Pre-auth succeeded but DB update failed — contact support' },
      { status: 500 }
    )
  }

  console.log(`[preauthorize] Authorized job ${params.id} — intent ${intent.id}`)
  return NextResponse.json({ success: true, intent_id: intent.id })
}
