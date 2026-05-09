// @ts-nocheck
// POST /api/secure-card/create-intent { token }
// Called after elements.submit() succeeds (deferred Elements mode).
// Creates a Stripe Customer on the connected account, saves it to the job,
// then creates a SetupIntent and returns the clientSecret.
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
  try {
    const body = await request.json()
    token = body.token
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      card_setup_token_expires_at,
      customer:customers(full_name, email),
      business:businesses(stripe_account_id)
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

  // Create customer on the connected account
  let stripeCustomerId: string
  try {
    const customer = await stripe.customers.create(
      {
        email: job.customer?.email,
        name: job.customer?.full_name,
        metadata: { job_id: job.id },
      },
      stripeOpts
    )
    stripeCustomerId = customer.id
  } catch (err: any) {
    console.error('[secure-card/create-intent] Stripe customer create failed:', err.message)
    return NextResponse.json({ error: 'Failed to initialise payment' }, { status: 500 })
  }

  // Persist customer ID to the job so the save endpoint can find it
  await supabase.from('jobs').update({ stripe_customer_id: stripeCustomerId }).eq('id', job.id)

  // Create SetupIntent on the connected account
  let clientSecret: string
  try {
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: stripeCustomerId,
        usage: 'off_session',
        // Apple Pay and Google Pay are card-based — they appear via ECE without listing here
        payment_method_types: ['card'],
      },
      stripeOpts
    )
    clientSecret = setupIntent.client_secret!
  } catch (err: any) {
    console.error('[secure-card/create-intent] SetupIntent create failed:', err.message)
    return NextResponse.json({ error: 'Failed to initialise payment' }, { status: 500 })
  }

  return NextResponse.json({ clientSecret })
}
