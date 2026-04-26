import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { jobId, invoiceId, businessId, customerId } = session.metadata!

    const amount = session.amount_total || 0
    const paymentIntentId = session.payment_intent as string

    if (jobId) {
      await supabase.from('jobs').update({
        status: 'completed',
        stripe_payment_intent_id: paymentIntentId,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)

      await supabase.from('activity_logs').insert({
        business_id: businessId,
        event_type: 'payment_received',
        description: `Payment received for job`,
        entity_type: 'job',
        entity_id: jobId,
        metadata: { amount, payment_intent_id: paymentIntentId },
      })
    }

    if (invoiceId) {
      await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      }).eq('id', invoiceId)

      await supabase.from('activity_logs').insert({
        business_id: businessId,
        event_type: 'payment_received',
        description: `Invoice paid`,
        entity_type: 'invoice',
        entity_id: invoiceId,
        metadata: { amount, payment_intent_id: paymentIntentId },
      })
    }

    // Update customer lifetime value
    if (customerId && amount > 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('lifetime_value, total_bookings')
        .eq('id', customerId)
        .single()

      if (customer) {
        await supabase.from('customers').update({
          lifetime_value: (customer.lifetime_value || 0) + amount,
          total_bookings: (customer.total_bookings || 0) + 1,
          last_booking_at: new Date().toISOString(),
        }).eq('id', customerId)
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const { jobId, invoiceId, businessId } = paymentIntent.metadata

    await supabase.from('activity_logs').insert({
      business_id: businessId,
      event_type: 'payment_failed',
      description: `Payment failed`,
      entity_type: jobId ? 'job' : 'invoice',
      entity_id: jobId || invoiceId,
    })
  }

  return NextResponse.json({ received: true })
}
