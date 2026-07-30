// @ts-nocheck
// POST /api/jobs/[id]/refund — requires authenticated session.
// Refunds a paid job via Stripe (full, or a partial amount up to what was charged).
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

  // Optional partial amount (cents). Omitted = full refund.
  let amountToRefund: number | undefined
  try {
    const body = await request.json()
    if (body.amountCents !== undefined && body.amountCents !== null) {
      amountToRefund = Number(body.amountCents)
    }
  } catch {
    // no body — full refund
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      id,
      payment_status,
      total_price,
      price,
      final_charged_amount,
      stripe_payment_intent_id,
      business:businesses(stripe_account_id)
    `)
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.payment_status !== 'paid') {
    return NextResponse.json(
      { error: `Can only refund a paid job — payment status is '${job.payment_status}'` },
      { status: 409 }
    )
  }

  if (!job.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No payment on record to refund' }, { status: 409 })
  }

  const chargedCents = job.final_charged_amount ?? job.total_price ?? job.price ?? 0

  if (amountToRefund !== undefined) {
    if (!Number.isFinite(amountToRefund) || amountToRefund <= 0) {
      return NextResponse.json({ error: 'Refund amount must be greater than $0' }, { status: 400 })
    }
    if (amountToRefund > chargedCents) {
      return NextResponse.json(
        { error: `Refund cannot exceed the charged amount ($${(chargedCents / 100).toFixed(2)})` },
        { status: 400 }
      )
    }
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

  let refund: Stripe.Refund
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: job.stripe_payment_intent_id,
        ...(amountToRefund !== undefined ? { amount: amountToRefund } : {}),
      },
      stripeOpts
    )
  } catch (err: any) {
    console.error(`[refund] Stripe refund failed for job ${params.id}:`, err.message)
    return NextResponse.json({ error: err.message || 'Refund failed' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ payment_status: 'refunded' })
    .eq('id', params.id)

  if (updateError) {
    console.error(`[refund] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json(
      { error: 'Refund succeeded but DB update failed — contact support' },
      { status: 500 }
    )
  }

  console.log(`[refund] Refunded job ${params.id} — refund ${refund.id}, amount ${refund.amount}`)
  return NextResponse.json({ success: true, amount_refunded: refund.amount })
}
