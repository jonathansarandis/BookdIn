// @ts-nocheck
// POST /api/secure-card/save  { token, paymentMethodId }
// No auth required — token IS the proof of identity.
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

export async function POST(request: NextRequest) {
  let token: string
  let paymentMethodId: string

  try {
    const body = await request.json()
    token = body.token
    paymentMethodId = body.paymentMethodId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token || !paymentMethodId) {
    return NextResponse.json({ error: 'Missing token or paymentMethodId' }, { status: 400 })
  }

  // Re-validate token (same conditions as validate endpoint)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      total_price,
      customer_id,
      card_setup_token_expires_at,
      stripe_payment_method_id,
      customer:customers(full_name, email),
      business:businesses(name, stripe_account_id, currency)
    `)
    .eq('card_setup_token', token)
    .is('stripe_payment_method_id', null)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  if (job.card_setup_token_expires_at && new Date(job.card_setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

  let stripeCustomerId: string

  try {
    // Create a Stripe customer on the connected account for this booking
    const stripeCustomer = await stripe.customers.create(
      {
        email: job.customer?.email,
        name: job.customer?.full_name,
        metadata: { job_id: job.id },
      },
      stripeOpts
    )
    stripeCustomerId = stripeCustomer.id
  } catch (err: any) {
    console.error('[secure-card/save] Stripe customer create failed:', err.message)
    return NextResponse.json({ error: 'Failed to create customer record' }, { status: 500 })
  }

  try {
    // Attach the payment method to the customer on the connected account
    await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: stripeCustomerId },
      stripeOpts
    )
  } catch (err: any) {
    console.error('[secure-card/save] PaymentMethod attach failed:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to save card' }, { status: 400 })
  }

  // Consume token and record the payment method
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: stripeCustomerId,
      payment_status: 'card_on_file',
      card_setup_token: null,
      card_setup_token_expires_at: null,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[secure-card/save] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to record card — please contact support' }, { status: 500 })
  }

  console.log(`[secure-card/save] Card saved for job ${job.id}`)
  return NextResponse.json({ success: true })
}
