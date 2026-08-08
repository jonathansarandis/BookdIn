// @ts-nocheck
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { jobId, paymentMethodId } = await request.json()

    // Get job details
    const { data: job } = await supabase
      .from('jobs')
      .select('*, customer:customers(id, full_name, email)')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!job.total_price || job.total_price <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

    // Create PaymentIntent with manual capture (holds funds, captures day before service)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: job.price_override ?? job.total_price,
      currency: 'aud',
      payment_method: paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      description: `Job ${jobId} - ${job.customer?.full_name || 'Customer'}`,
      metadata: { jobId },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/jobs/${jobId}`,
    })

    // Save payment intent ID to job
    await supabase
      .from('jobs')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: paymentIntent.status === 'requires_capture' ? 'authorized' : 'pending',
        payment_method: 'card',
      })
      .eq('id', jobId)

    // Successful auth on a fresh card (not one already reused from customer_payment_methods) —
    // save it so it's offered as "saved card" next time this customer is booked.
    if (paymentIntent.status === 'requires_capture' && job.customer?.id && job.business_id) {
      try {
        const pmDetails = await stripe.paymentMethods.retrieve(paymentMethodId)
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
        // Non-blocking — the charge/authorization already succeeded either way
        console.error('[stripe/intent] customer_payment_methods upsert failed (non-blocking):', cpmErr.message)
      }
    }

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      requiresAction: paymentIntent.status === 'requires_action',
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    console.error('Payment intent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
