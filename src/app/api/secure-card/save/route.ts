// @ts-nocheck
// POST /api/secure-card/save  { token, paymentMethodId }
// create-intent already wrote stripe_customer_id to the job.
// This endpoint persists the confirmed payment method, upserts customer_payment_methods, and consumes the token.
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
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  console.log(`[secure-card/save] received token=${token?.slice(0,8)}... pm=${paymentMethodId}`)

  // Re-validate token (expired check + not-yet-saved guard)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, business_id, scheduled_at, card_setup_token_expires_at, customer:customers(id, full_name), business:businesses(timezone, stripe_account_id)')
    .eq('card_setup_token', token)
    .is('stripe_payment_method_id', null)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
  }

  if (job.card_setup_token_expires_at && new Date(job.card_setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 })
  }

  console.log(`[secure-card/save] matched job ${job?.id ?? 'NONE'} for token=${token?.slice(0,8)}...`)

  // stripe_customer_id is already on the job (set by create-intent).
  // Just record the confirmed payment method and consume the token.
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      stripe_payment_method_id: paymentMethodId,
      payment_status: 'card_on_file',
      card_setup_token: null,
      card_setup_token_expires_at: null,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[secure-card/save] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to record card — please contact support' }, { status: 500 })
  }

  // Upsert customer_payment_methods: one record per (customer, business), keyed on the unique constraint.
  if (job.customer?.id && job.business_id) {
    try {
      const stripeOpts = job.business?.stripe_account_id
        ? { stripeAccount: job.business.stripe_account_id }
        : {}
      const pmDetails = await stripe.paymentMethods.retrieve(paymentMethodId, stripeOpts)
      await supabase.from('customer_payment_methods').upsert({
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
      // Non-blocking — PM is already saved on the job; junction failure is recoverable
      console.error('[secure-card/save] customer_payment_methods upsert failed (non-blocking):', cpmErr.message)
    }
  }

  console.log(`[secure-card/save] Card saved for job ${job.id}`)

  // Same-day auth notification — fires only when scheduled_at is today in business timezone
  try {
    const jobTz = job.business?.timezone || 'Australia/Melbourne'
    const jobDateMelbourne = new Intl.DateTimeFormat('en-AU', {
      timeZone: jobTz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(job.scheduled_at))
    const todayMelbourne = new Intl.DateTimeFormat('en-AU', {
      timeZone: jobTz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())

    if (jobDateMelbourne === todayMelbourne) {
      const { data: staff } = await supabase
        .from('profiles')
        .select('id')
        .eq('business_id', job.business_id)

      if (staff?.length) {
        const dateLabel = new Date(job.scheduled_at).toLocaleDateString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric', timeZone: jobTz,
        })
        const customerName = job.customer?.full_name ?? 'Unknown'
        await supabase.from('notifications').insert(
          staff.map((s: { id: string }) => ({
            business_id: job.business_id,
            user_id: s.id,
            type: 'same_day_auth_required',
            title: `Same-day auth required — ${customerName}`,
            body: `Card saved for today's booking (${dateLabel}). Authorize manually before service.`,
            entity_type: 'job',
            entity_id: job.id,
            action_url: `/jobs/${job.id}`,
          }))
        )
      }
    }
  } catch (notifErr: any) {
    console.error(`[secure-card/save] same_day_auth_required notification failed (non-blocking):`, notifErr.message)
  }

  return NextResponse.json({ success: true })
}
