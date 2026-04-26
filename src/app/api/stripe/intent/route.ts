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
      .select('*, customer:customers(full_name, email)')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!job.total_price || job.total_price <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

    // Create PaymentIntent with manual capture (holds funds, captures day before service)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: job.total_price,
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
