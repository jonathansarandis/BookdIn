// @ts-nocheck
// DELETE /api/customers/[id]/payment-method
// Detaches the Stripe PM and removes the customer_payment_methods row.
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

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // Auth — operator must belong to this customer's business
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

  // Verify the customer belongs to this business and fetch the PM row
  const { data: cpm } = await supabase
    .from('customer_payment_methods')
    .select(`
      id,
      stripe_payment_method_id,
      customer:customers!inner(id, business_id),
      business:businesses(stripe_account_id)
    `)
    .eq('customer_id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (!cpm) {
    return NextResponse.json({ error: 'No payment method on file' }, { status: 404 })
  }

  const stripeAccountId = cpm.business?.stripe_account_id
  const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : {}

  // Detach from Stripe (non-blocking — card may already be detached)
  try {
    await stripe.paymentMethods.detach(cpm.stripe_payment_method_id, stripeOpts)
  } catch (err: any) {
    console.error(`[customers/payment-method] PM detach failed (continuing):`, err.message)
  }

  // Delete the junction row
  await supabase
    .from('customer_payment_methods')
    .delete()
    .eq('customer_id', params.id)
    .eq('business_id', profile.business_id)

  return NextResponse.json({ detached: true })
}
