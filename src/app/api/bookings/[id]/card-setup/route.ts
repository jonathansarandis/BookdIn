// @ts-nocheck
// src/app/api/bookings/[id]/card-setup/route.ts
// Redirects customer to a Stripe SetupIntent page to save their card
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const { data: job } = await supabase
    .from('jobs')
    .select('*, customer:customers(id, full_name, email, stripe_customer_id), business:businesses(id, name, stripe_account_id)')
    .eq('id', params.id)
    .single()

  if (!job) {
    return NextResponse.redirect(`${appUrl}/booking-not-found`)
  }

  // If already paid, redirect to success
  if (job.payment_status === 'paid' || job.stripe_payment_intent_id) {
    return NextResponse.redirect(`${appUrl}/booking-confirmed?job=${params.id}`)
  }

  try {
    // Create a Stripe checkout session in setup mode to save card
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'setup',
        payment_method_types: ['card'],
        customer_email: job.customer?.email,
        success_url: `${appUrl}/booking-confirmed?job=${params.id}`,
        cancel_url: `${appUrl}/booking-cancelled`,
        metadata: {
          job_id: params.id,
          business_id: job.business_id,
        },
      },
      job.business?.stripe_account_id
        ? { stripeAccount: job.business.stripe_account_id }
        : undefined
    )

    return NextResponse.redirect(session.url!)
  } catch (err: any) {
    console.error('Card setup error:', err)
    return NextResponse.redirect(`${appUrl}/booking-confirmed?job=${params.id}&error=card_setup_failed`)
  }
}
