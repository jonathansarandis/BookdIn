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
      customer_id,
      payment_status,
      stripe_payment_method_id,
      stripe_payment_intent_id,
      business:businesses(stripe_account_id)
    `)
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const allowedStatuses = ['card_on_file', 'authorized', 'auth_failed', 'capture_failed']
  if (!allowedStatuses.includes(job.payment_status)) {
    return NextResponse.json(
      { error: `Cannot cancel card — payment status is '${job.payment_status}'` },
      { status: 409 }
    )
  }

  if (job.payment_status === 'authorized' && job.stripe_payment_intent_id) {
    const stripeAccountId = job.business?.stripe_account_id
    const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    try {
      await stripe.paymentIntents.cancel(job.stripe_payment_intent_id, stripeOpts)
    } catch (err: any) {
      console.error(`[cancel-card] Stripe intent cancel failed for job ${params.id}:`, err.message)
    }
  }

  // Detach PM from Stripe so the card cannot be reused on this customer
  if (job.stripe_payment_method_id) {
    try {
      await stripe.paymentMethods.detach(job.stripe_payment_method_id, stripeOpts)
    } catch (err: any) {
      // Non-blocking: PM may already be detached or card closed by the bank
      console.error(`[cancel-card] PM detach failed (continuing):`, err.message)
    }
  }

  // Remove from junction table
  if (job.customer_id && profile.business_id) {
    await supabase
      .from('customer_payment_methods')
      .delete()
      .eq('customer_id', job.customer_id)
      .eq('business_id', profile.business_id)
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      payment_status: 'unpaid',
      stripe_payment_method_id: null,
      stripe_customer_id: null,
      stripe_payment_intent_id: null,
    })
    .eq('id', params.id)

  if (updateError) {
    console.error(`[cancel-card] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'DB update failed — contact support' }, { status: 500 })
  }

  console.log(`[cancel-card] Cleared card for job ${params.id}`)
  return NextResponse.json({ success: true })
}
