// @ts-nocheck
// POST /api/jobs/[id]/reconcile-card-setup
//
// Recovery path for the known "card saved on Stripe but never persisted to
// BookdIn" failure: when a card issuer requires 3D Secure, Stripe.js does a
// full-page redirect to the bank and back. If that round trip happens inside
// an email client's in-app browser (Gmail/Outlook WebView), the browser can
// fail to land back on /secure-card/[token] with the right query params —
// so neither the client-side save (POST /secure-card/save) nor the
// setup_intent.succeeded webhook's usual real-time delivery reliably
// completes, even though the customer's bank already confirmed the card.
//
// This route asks Stripe directly, scoped as tightly as possible to avoid
// touching any other job or customer's data:
//   - only looks at THIS job (business-ownership checked)
//   - no-ops immediately if a card is already on file for this job
//   - only considers Stripe SetupIntents whose metadata.jobId matches this
//     job's id exactly (set by create-intent/route.ts at creation time) —
//     never "the customer's most recent card", since one customer can have
//     several jobs/bookings each with their own SetupIntent
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  if (!profile?.business_id) {
    return NextResponse.json({ error: 'No business' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select(`
      id, business_id, stripe_payment_method_id, stripe_customer_id,
      customer:customers(id, stripe_customer_id),
      business:businesses(stripe_account_id)
    `)
    .eq('id', params.id)
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Already has a card on file — never overwrite. This is the single most
  // important guard in this file: it's what guarantees this route can never
  // clobber a correctly-saved card, on this job or (since we never touch any
  // other row) any other.
  if (job.stripe_payment_method_id) {
    return NextResponse.json({ reconciled: false, reason: 'already_saved' })
  }

  const stripeAccountId = job.business?.stripe_account_id
  const stripeCustomerId = job.customer?.stripe_customer_id || job.stripe_customer_id
  if (!stripeCustomerId) {
    return NextResponse.json({ reconciled: false, reason: 'no_stripe_customer' })
  }
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : {}

  let setupIntents: Stripe.SetupIntent[]
  try {
    const list = await stripe.setupIntents.list(
      { customer: stripeCustomerId, limit: 20 },
      stripeOpts
    )
    setupIntents = list.data
  } catch (err: any) {
    console.error('[reconcile-card-setup] Stripe list failed:', err.message)
    return NextResponse.json({ error: 'Stripe lookup failed' }, { status: 500 })
  }

  // Strict match on this job's id in metadata — never just "most recent for
  // this customer". Prefer the most recently created if somehow more than one.
  const match = setupIntents
    .filter(si => si.status === 'succeeded' && si.metadata?.jobId === job.id)
    .sort((a, b) => b.created - a.created)[0]

  if (!match) {
    return NextResponse.json({ reconciled: false, reason: 'no_succeeded_setup_intent_for_job' })
  }

  const paymentMethodId = typeof match.payment_method === 'string'
    ? match.payment_method
    : match.payment_method?.id

  if (!paymentMethodId) {
    return NextResponse.json({ reconciled: false, reason: 'setup_intent_has_no_payment_method' })
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      payment_status: 'card_on_file',
      card_setup_token: null,
      card_setup_token_expires_at: null,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[reconcile-card-setup] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
  }

  // Best-effort, same as the webhook's own fallback — not critical if it fails.
  if (job.customer?.id && job.business_id) {
    try {
      const pmDetails = await stripe.paymentMethods.retrieve(paymentMethodId, stripeOpts)
      await admin.from('customer_payment_methods').upsert({
        customer_id:              job.customer.id,
        business_id:              job.business_id,
        stripe_payment_method_id: paymentMethodId,
        card_brand:               pmDetails.card?.brand ?? null,
        card_last4:               pmDetails.card?.last4 ?? null,
        card_exp_month:           pmDetails.card?.exp_month ?? null,
        card_exp_year:            pmDetails.card?.exp_year ?? null,
        updated_at:               new Date().toISOString(),
      }, { onConflict: 'customer_id,business_id' })
    } catch (cpmErr: any) {
      console.error('[reconcile-card-setup] customer_payment_methods upsert failed (non-blocking):', cpmErr.message)
    }
  }

  console.log(`[reconcile-card-setup] Recovered card for job ${job.id} from SetupIntent ${match.id}`)

  return NextResponse.json({
    reconciled: true,
    paymentMethodId,
    setupIntentId: match.id,
    setupIntentCreatedAt: new Date(match.created * 1000).toISOString(),
  })
}
