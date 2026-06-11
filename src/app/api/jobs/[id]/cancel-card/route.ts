// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

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

  const admin = createAdminClient()
  const { data: job, error: jobError } = await admin
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
      { error: `Cannot release pre-auth — payment status is '${job.payment_status}'` },
      { status: 409 }
    )
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

  if (job.stripe_payment_intent_id) {
    try {
      await stripe.paymentIntents.cancel(job.stripe_payment_intent_id, {}, stripeOpts)
      console.log(`[cancel-card] Released Stripe hold for job ${params.id}, intent ${job.stripe_payment_intent_id}`)
    } catch (err: any) {
      console.error(`[cancel-card] Stripe intent cancel failed for job ${params.id}:`, err.message)
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('jobs')
    .update({ payment_status: 'auth_released' })
    .eq('id', params.id)
    .select('id, payment_status, stripe_payment_method_id, stripe_customer_id, stripe_payment_intent_id')
    .single()

  if (updateError) {
    console.error(`[cancel-card] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'DB update failed — contact support' }, { status: 500 })
  }

  console.log(`[cancel-card] auth_released for job ${params.id}:`, JSON.stringify(updated))
  return NextResponse.json({ success: true, job: updated })
}
