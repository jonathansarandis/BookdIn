// @ts-nocheck
// app/api/stripe/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log("[stripe/connect] auth user:", { id: user?.id, email: user?.email, authError });
  if (authError || !user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .single()

  console.log("[stripe/connect] business lookup:", { userId: user?.id, business, error });
  if (error || !business) {
    return NextResponse.redirect(`${appUrl}/settings?stripe_error=business_not_found`)
  }

  try {
    let stripeAccountId = business.stripe_account_id

    // Create a Stripe account for this business if they don't have one yet
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'AU',
        email: user.email,
      })

      stripeAccountId = account.id

      await supabase
        .from('businesses')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', business.id)
    }

    // Create an Account Link — this is the URL we send the user to
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/api/stripe/connect`,
      return_url: `${appUrl}/api/stripe/callback?business_id=${business.id}`,
      type: 'account_onboarding',
    })

    return NextResponse.redirect(accountLink.url)
  } catch (err: any) {
    console.error('Stripe Connect error:', err)
    return NextResponse.redirect(
      `${appUrl}/settings?stripe_error=${encodeURIComponent(err.message)}`
    )
  }
}
