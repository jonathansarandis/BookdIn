// @ts-nocheck
// app/api/stripe/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  if (!businessId) {
    return NextResponse.redirect(`${appUrl}/settings?stripe_error=missing_business_id`)
  }

  try {
    // Look up the business to get their stripe_account_id
    const { data: business, error } = await supabase
      .from('businesses')
      .select('stripe_account_id')
      .eq('id', businessId)
      .single()

    if (error || !business?.stripe_account_id) {
      return NextResponse.redirect(`${appUrl}/settings?stripe_error=account_not_found`)
    }

    // Fetch the latest account status from Stripe
    const account = await stripe.accounts.retrieve(business.stripe_account_id)

    // Update charges/payouts status in DB
    await supabase
      .from('businesses')
      .update({
        stripe_connected_at: new Date().toISOString(),
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq('id', businessId)

    return NextResponse.redirect(`${appUrl}/settings?stripe_success=true`)
  } catch (err: any) {
    console.error('Stripe callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/settings?stripe_error=${encodeURIComponent(err.message)}`
    )
  }
}
