// @ts-nocheck
// GET /api/customers/[id]/cards
// Lists every card the customer has on file in Stripe (a customer can have several),
// so staff can pick which one to attach to a booking.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile?.business_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: customer }, { data: biz }, { data: cpm }] = await Promise.all([
    admin.from('customers').select('id, stripe_customer_id').eq('id', params.id).eq('business_id', profile.business_id).single(),
    admin.from('businesses').select('stripe_account_id').eq('id', profile.business_id).single(),
    admin.from('customer_payment_methods').select('stripe_payment_method_id').eq('customer_id', params.id).eq('business_id', profile.business_id).maybeSingle(),
  ])
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!customer.stripe_customer_id) return NextResponse.json({ cards: [] })

  const opts = biz?.stripe_account_id ? { stripeAccount: biz.stripe_account_id } : {}
  try {
    const list = await stripe.paymentMethods.list({ customer: customer.stripe_customer_id, type: 'card', limit: 20 }, opts)
    const cards = list.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      isDefault: pm.id === cpm?.stripe_payment_method_id,
    }))
    cards.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    return NextResponse.json({ cards })
  } catch (err: any) {
    console.error('[customers/cards] Stripe list failed:', err.message)
    return NextResponse.json({ cards: [], error: 'Could not load cards' })
  }
}
