// @ts-nocheck
// lib/stripe/createCheckoutSession.ts
// Use this helper anywhere you create a Stripe checkout session.
// It automatically routes payments to the business's connected Stripe account.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CreateSessionParams {
  businessId: string
  amountCents: number        // amount in cents AUD
  description: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
  customerEmail?: string
}

export async function createCheckoutSession(params: CreateSessionParams) {
  const {
    businessId,
    amountCents,
    description,
    successUrl,
    cancelUrl,
    metadata = {},
    customerEmail,
  } = params

  // Look up the business's connected Stripe account
  const { data: business, error } = await supabase
    .from('businesses')
    .select('stripe_account_id, stripe_charges_enabled, name')
    .eq('id', businessId)
    .single()

  if (error || !business) {
    throw new Error('Business not found')
  }

  if (!business.stripe_account_id) {
    throw new Error('This business has not connected a Stripe account yet')
  }

  if (!business.stripe_charges_enabled) {
    throw new Error('This business\'s Stripe account is not yet enabled for charges')
  }

  // Create the checkout session on the CONNECTED account (not your platform account)
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: amountCents,
            product_data: {
              name: description,
              // Optional: add business name as statement descriptor
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    },
    {
      // This is the key line — routes payment to the connected account
      stripeAccount: business.stripe_account_id,
    }
  )

  return session
}


// ------------------------------------------------------------------
// Creating a PaymentIntent directly (e.g. for card capture at booking)
// ------------------------------------------------------------------

interface CreatePaymentIntentParams {
  businessId: string
  amountCents: number
  captureMethod?: 'automatic' | 'manual'  // manual = auth only, capture later
  metadata?: Record<string, string>
}

export async function createPaymentIntent(params: CreatePaymentIntentParams) {
  const { businessId, amountCents, captureMethod = 'automatic', metadata = {} } = params

  const { data: business, error } = await supabase
    .from('businesses')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', businessId)
    .single()

  if (error || !business?.stripe_account_id) {
    throw new Error('Business Stripe account not found')
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'aud',
      capture_method: captureMethod,
      metadata,
    },
    {
      stripeAccount: business.stripe_account_id,
    }
  )

  return paymentIntent
}
