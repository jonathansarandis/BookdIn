// @ts-nocheck
// POST /api/customers/[id]/repair-stripe-link
//
// Fixes the "Card saved, but Pre-authorize says No card on file" bug.
//
// /api/jobs/[id]/preauthorize (and attach-saved-card) require BOTH:
//   - jobs.stripe_payment_method_id / customer_payment_methods (the card itself)
//   - customers.stripe_customer_id (the Stripe Customer object the card is
//     attached to)
//
// Two independent code paths can leave customer_payment_methods populated
// while customers.stripe_customer_id stays null:
//   1. The legacy /api/bookings/[id]/card-setup Checkout Session flow (see
//      reconcile-card-setup) — Stripe auto-creates a real Customer for a
//      setup-mode session, but our code never captured its id.
//   2. /api/stripe/intent (the "Charge directly" flow with a brand-new
//      card) — creates a PaymentIntent without ever creating/attaching a
//      Stripe Customer at all, so the "saved" card isn't actually attached
//      to any Customer on Stripe's side.
//
// This repairs both: if the on-file PaymentMethod already belongs to a
// Stripe Customer (case 1), just backfill our column. If it belongs to no
// Customer at all (case 2), create one now and attach the existing
// PaymentMethod to it. Scoped to exactly this customer — never touches any
// other customer's data, and no-ops if already fine.
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

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .select('id, business_id, full_name, email, stripe_customer_id')
    .eq('id', params.id)
    .single()

  if (customerError || !customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  if (customer.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (customer.stripe_customer_id) {
    return NextResponse.json({ repaired: false, reason: 'already_linked' })
  }

  const { data: business } = await admin
    .from('businesses')
    .select('stripe_account_id')
    .eq('id', customer.business_id)
    .single()
  const stripeAccountId = business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : {}

  const { data: cpm } = await admin
    .from('customer_payment_methods')
    .select('stripe_payment_method_id')
    .eq('customer_id', customer.id)
    .eq('business_id', customer.business_id)
    .single()

  if (!cpm?.stripe_payment_method_id) {
    return NextResponse.json({ repaired: false, reason: 'no_saved_card' })
  }

  let pm: Stripe.PaymentMethod
  try {
    pm = await stripe.paymentMethods.retrieve(cpm.stripe_payment_method_id, stripeOpts)
  } catch (err: any) {
    console.error('[repair-stripe-link] PaymentMethod retrieve failed:', err.message)
    return NextResponse.json({ error: 'Stripe lookup failed' }, { status: 500 })
  }

  let stripeCustomerId = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id

  if (!stripeCustomerId) {
    // Case 2 — card was never attached to any Stripe Customer. Create one now
    // and attach the existing payment method to it.
    try {
      const newCustomer = await stripe.customers.create(
        { email: customer.email, name: customer.full_name, metadata: { customer_id: customer.id } },
        stripeOpts
      )
      await stripe.paymentMethods.attach(cpm.stripe_payment_method_id, { customer: newCustomer.id }, stripeOpts)
      stripeCustomerId = newCustomer.id
    } catch (err: any) {
      console.error('[repair-stripe-link] Stripe customer create/attach failed:', err.message)
      return NextResponse.json({ error: 'Stripe repair failed' }, { status: 500 })
    }
  }

  const { error: updateError } = await admin
    .from('customers')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('id', customer.id)

  if (updateError) {
    console.error('[repair-stripe-link] DB update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  console.log(`[repair-stripe-link] Linked customer ${customer.id} to Stripe customer ${stripeCustomerId}`)

  return NextResponse.json({ repaired: true, stripeCustomerId })
}
