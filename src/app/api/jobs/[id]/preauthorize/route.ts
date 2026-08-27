// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getChargeableAmount } from '@/lib/pricing'

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
      customer_id,
      payment_status,
      price_override,
      total_price,
      price,
      stripe_payment_method_id,
      customer:customers(id, stripe_customer_id),
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

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  const currency = (job.business?.currency || 'aud').toLowerCase()

  // Self-heal: this job's own copy of the card, and/or the customer's Stripe
  // Customer link, can end up missing even when the UI shows "Card saved" —
  // several different booking paths have been found to leave this
  // inconsistent. Rather than dead-ending staff with "No card on file" when
  // the customer plainly has a verified card on file, fall back to it here
  // and backfill the job/customer so they're consistent going forward.
  let stripePaymentMethodId = job.stripe_payment_method_id
  let stripeCustomerId = job.customer?.stripe_customer_id

  if (!stripePaymentMethodId || !stripeCustomerId) {
    const { data: cpm } = await supabase
      .from('customer_payment_methods')
      .select('stripe_payment_method_id')
      .eq('customer_id', job.customer_id)
      .eq('business_id', profile.business_id)
      .single()

    if (!cpm?.stripe_payment_method_id) {
      return NextResponse.json({ error: 'No card on file' }, { status: 409 })
    }
    stripePaymentMethodId = cpm.stripe_payment_method_id

    if (!stripeCustomerId) {
      // The card itself is verified — find (or, failing that, create and
      // attach) the Stripe Customer it belongs to.
      try {
        const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId, stripeOpts)
        stripeCustomerId = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id

        if (!stripeCustomerId) {
          const newCustomer = await stripe.customers.create({}, stripeOpts)
          await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: newCustomer.id }, stripeOpts)
          stripeCustomerId = newCustomer.id
        }

        await supabase.from('customers').update({ stripe_customer_id: stripeCustomerId }).eq('id', job.customer_id)
      } catch (err: any) {
        console.error(`[preauthorize] Self-heal Stripe customer link failed for job ${params.id}:`, err.message)
        return NextResponse.json({ error: 'No card on file' }, { status: 409 })
      }
    }

    // Backfill so the job's own record is correct from here on.
    await supabase
      .from('jobs')
      .update({ stripe_payment_method_id: stripePaymentMethodId })
      .eq('id', params.id)
  }

  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create({
      amount: getChargeableAmount(job),
      currency,
      customer: stripeCustomerId,
      payment_method: stripePaymentMethodId,
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
