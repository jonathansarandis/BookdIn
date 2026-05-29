// @ts-nocheck
// TODO: schema.sql is out of sync with prod for jobs.parent_job_id and jobs.location_id — sync post-launch
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
  req: Request,
  { params }: { params: { id: string } }
) {
  // Auth
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

  // Parse body
  let amount_cents: number
  let notes: string
  try {
    const body = await req.json()
    amount_cents = body.amount_cents
    notes = body.notes ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Fetch parent job
  const { data: parent, error: parentError } = await supabase
    .from('jobs')
    .select(`
      id,
      business_id,
      customer_id,
      location_id,
      address_id,
      payment_status,
      stripe_payment_method_id,
      customer:customers(stripe_customer_id),
      business:businesses(stripe_account_id, currency)
    `)
    .eq('id', params.id)
    .single()

  if (parentError || !parent) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Guards
  if (parent.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  if (!['paid', 'authorized'].includes(parent.payment_status)) {
    return NextResponse.json(
      { error: 'Parent must be paid or authorized' },
      { status: 409 }
    )
  }

  if (!parent.stripe_payment_method_id) {
    return NextResponse.json({ error: 'No saved payment method on parent' }, { status: 409 })
  }

  if (!parent.customer?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer on parent' }, { status: 409 })
  }

  // Prefer the customer's currently-saved PM (junction table), fall back to parent job's snapshot
  const { data: cpm } = await supabase
    .from('customer_payment_methods')
    .select('stripe_payment_method_id')
    .eq('customer_id', parent.customer_id)
    .eq('business_id', parent.business_id)
    .single()

  const paymentMethodIdToUse = cpm?.stripe_payment_method_id ?? parent.stripe_payment_method_id

  // Look up the per-business Custom service
  const { data: customService, error: svcError } = await supabase
    .from('services')
    .select('id')
    .eq('business_id', parent.business_id)
    .eq('pricing_type', 'custom')
    .single()

  if (svcError || !customService) {
    console.error(`[follow-up-charge] Custom service not found for business ${parent.business_id}`)
    return NextResponse.json(
      { error: 'Custom service not seeded for this business' },
      { status: 500 }
    )
  }

  // Create child job
  const { data: child, error: childError } = await supabase
    .from('jobs')
    .insert({
      business_id:              parent.business_id,
      customer_id:              parent.customer_id,
      location_id:              parent.location_id,
      address_id:               parent.address_id,
      service_id:               customService.id,
      parent_job_id:            parent.id,
      total_price:              amount_cents,
      scheduled_at:             new Date().toISOString(),
      status:                   'confirmed',
      payment_status:           'card_on_file',
      booking_source:           'manual',
      customer_notes:           notes,
      stripe_customer_id:       parent.customer.stripe_customer_id,
      stripe_payment_method_id: paymentMethodIdToUse,
    })
    .select('id')
    .single()

  if (childError || !child) {
    console.error(`[follow-up-charge] Failed to create child job:`, childError?.message)
    return NextResponse.json({ error: 'Failed to create follow-up job' }, { status: 500 })
  }

  // Stripe PaymentIntent — authorize only, capture later
  const currency = (parent.business?.currency || 'aud').toLowerCase()
  const stripeAccountId = parent.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency,
      customer: parent.customer.stripe_customer_id,
      payment_method: paymentMethodIdToUse,
      capture_method: 'manual',
      off_session: true,
      confirm: true,
      metadata: {
        job_id:        child.id,
        parent_job_id: parent.id,
        type:          'follow_up',
      },
    }, stripeOpts)

    await supabase
      .from('jobs')
      .update({
        payment_status:           'authorized',
        stripe_payment_intent_id: intent.id,
      })
      .eq('id', child.id)

    console.log(`[follow-up-charge] Authorized child ${child.id} — intent ${intent.id}`)
    return NextResponse.json({ success: true, child_job_id: child.id })

  } catch (err: any) {
    console.error(`[follow-up-charge] Stripe failed for child ${child.id}:`, err.message)

    await supabase
      .from('jobs')
      .update({ payment_status: 'auth_failed' })
      .eq('id', child.id)

    return NextResponse.json({
      success:      false,
      child_job_id: child.id,
      error:        err.message,
    })
  }
}
