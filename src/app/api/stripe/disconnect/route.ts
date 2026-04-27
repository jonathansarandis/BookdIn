// @ts-nocheck
// app/api/stripe/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .single()

  if (error || !business?.stripe_account_id) {
    return NextResponse.json({ error: 'No connected Stripe account found' }, { status: 404 })
  }

  try {
    // Deauthorize the connected account from your platform
    await stripe.oauth.deauthorize({
      client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
      stripe_user_id: business.stripe_account_id,
    })
  } catch (err: any) {
    // If already disconnected on Stripe side, still clear our DB
    console.warn('Stripe deauthorize warning (may already be disconnected):', err.message)
  }

  // Clear from DB regardless
  await supabase
    .from('businesses')
    .update({
      stripe_account_id: null,
      stripe_connected_at: null,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq('id', business.id)

  return NextResponse.json({ success: true })
}
