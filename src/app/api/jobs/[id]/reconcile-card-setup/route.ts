// @ts-nocheck
// POST /api/jobs/[id]/reconcile-card-setup
//
// Recovery path for cards that were genuinely saved on Stripe's side but
// never persisted back to BookdIn. Two distinct failure modes feed into this:
//
// 1. The /secure-card/[token] SetupIntent flow (SMS/staff links): if a card
//    issuer requires 3D Secure, Stripe.js does a full-page redirect to the
//    bank and back. If that round trip happens inside an email client's
//    in-app browser (Gmail/Outlook WebView), the browser can fail to land
//    back with the right query params — so neither the client-side save
//    (POST /secure-card/save) nor the setup_intent.succeeded webhook fires.
//    Recovered here by matching Stripe SetupIntents by customer + metadata.jobId.
//
// 2. The legacy /api/bookings/[id]/card-setup flow (used by emailed
//    confirmation links until this was fixed): that route created a Stripe
//    Checkout Session in `mode: 'setup'` and, on completion, redirected to
//    booking-confirmed with NO code path that ever wrote stripe_customer_id
//    or stripe_payment_method_id back to the database — a systemic gap, not
//    an edge case. Recovered here by searching completed setup-mode Checkout
//    Sessions for metadata.job_id (snake_case, as that route wrote it)
//    matching this job — since these jobs never got a stripe_customer_id
//    saved, we can't search by customer, only by scanning sessions directly.
//
// This route asks Stripe directly, scoped as tightly as possible to avoid
// touching any other job or customer's data:
//   - only looks at THIS job (business-ownership checked)
//   - no-ops immediately if a card is already on file for this job
//   - only considers Stripe objects whose metadata ties them to this exact
//     job id — never "the customer's most recent card", since one customer
//     can have several jobs/bookings each with their own SetupIntent/Session
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
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : {}

  let paymentMethodId: string | undefined
  let matchSourceId: string | undefined
  let matchCreated: number | undefined
  let matchSource: 'setup_intent' | 'legacy_checkout_session' | undefined

  // Path 1: the /secure-card/[token] flow — SetupIntents tied to a known Stripe customer.
  if (stripeCustomerId) {
    let setupIntents: Stripe.SetupIntent[] = []
    try {
      const list = await stripe.setupIntents.list(
        { customer: stripeCustomerId, limit: 20 },
        stripeOpts
      )
      setupIntents = list.data
    } catch (err: any) {
      console.error('[reconcile-card-setup] Stripe SetupIntent list failed:', err.message)
      return NextResponse.json({ error: 'Stripe lookup failed' }, { status: 500 })
    }

    // Strict match on this job's id in metadata — never just "most recent for
    // this customer". Prefer the most recently created if somehow more than one.
    const match = setupIntents
      .filter(si => si.status === 'succeeded' && si.metadata?.jobId === job.id)
      .sort((a, b) => b.created - a.created)[0]

    if (match) {
      paymentMethodId = typeof match.payment_method === 'string'
        ? match.payment_method
        : match.payment_method?.id
      matchSourceId = match.id
      matchCreated = match.created
      matchSource = 'setup_intent'
    }
  }

  // Path 2: the legacy /api/bookings/[id]/card-setup flow — Checkout Sessions in
  // mode: 'setup' whose metadata.job_id (snake_case, as that route wrote it)
  // matches this job. These jobs never got a stripe_customer_id saved to BookdIn,
  // so we can't search by customer — scan completed setup-mode sessions directly,
  // paginating until we find this job's id or run out of sessions.
  if (!paymentMethodId) {
    try {
      let startingAfter: string | undefined
      let found: Stripe.Checkout.Session | undefined
      for (let page = 0; page < 20 && !found; page++) {
        const list = await stripe.checkout.sessions.list(
          { limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) },
          stripeOpts
        )
        found = list.data.find(
          s => s.mode === 'setup' && s.status === 'complete' && s.metadata?.job_id === job.id
        )
        if (found) break
        if (!list.has_more || list.data.length === 0) break
        startingAfter = list.data[list.data.length - 1].id
      }

      if (found?.setup_intent) {
        const setupIntentId = typeof found.setup_intent === 'string' ? found.setup_intent : found.setup_intent.id
        const si = await stripe.setupIntents.retrieve(setupIntentId, stripeOpts)
        if (si.status === 'succeeded') {
          paymentMethodId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id
          matchSourceId = found.id
          matchCreated = found.created
          matchSource = 'legacy_checkout_session'
        }
      }
    } catch (err: any) {
      console.error('[reconcile-card-setup] Legacy Checkout Session lookup failed:', err.message)
      // Don't hard-fail here if path 1 already ran cleanly and just found nothing —
      // fall through to the "no match" response below.
    }
  }

  if (!paymentMethodId || !matchSourceId) {
    return NextResponse.json({ reconciled: false, reason: 'no_match_found' })
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

  console.log(`[reconcile-card-setup] Recovered card for job ${job.id} via ${matchSource} ${matchSourceId}`)

  return NextResponse.json({
    reconciled: true,
    paymentMethodId,
    matchSource,
    matchSourceId,
    matchCreatedAt: matchCreated ? new Date(matchCreated * 1000).toISOString() : null,
  })
}
