// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  // mode 'release' = cancel the pre-auth hold but KEEP the saved card on file
  //                  (returns the job to card_on_file so it can be re-authorized).
  // mode 'remove'  = detach the card from this job (auth_released).
  // Default is 'release' — the safe, non-destructive behaviour.
  const body = await req.json().catch(() => ({}))
  const mode: 'release' | 'remove' = body?.mode === 'remove' ? 'remove' : 'release'

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

  // Releasing a hold requires an active authorization. Removing a card is also
  // valid straight from card_on_file (no active hold to release).
  const allowedStatuses = mode === 'remove'
    ? ['authorized', 'card_on_file']
    : ['authorized']
  if (!allowedStatuses.includes(job.payment_status)) {
    return NextResponse.json(
      { error: `Cannot ${mode === 'remove' ? 'remove card' : 'release pre-auth'} — payment status is '${job.payment_status}'` },
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

  // release -> back to card_on_file (card stays, can be re-authorized).
  // remove  -> auth_released (card detached from this job's active flow).
  const newStatus = mode === 'remove' ? 'auth_released' : 'card_on_file'

  const { data: updated, error: updateError } = await admin
    .from('jobs')
    .update({ payment_status: newStatus })
    .eq('id', params.id)
    .select('id, payment_status, stripe_payment_method_id, stripe_customer_id, stripe_payment_intent_id')
    .single()

  if (updateError) {
    console.error(`[cancel-card] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'DB update failed — contact support' }, { status: 500 })
  }

  console.log(`[cancel-card] mode=${mode} -> ${newStatus} for job ${params.id}:`, JSON.stringify(updated))
  return NextResponse.json({ success: true, job: updated })
}
