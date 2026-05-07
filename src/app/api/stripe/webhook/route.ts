// @ts-nocheck
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReceipt } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

async function sendJobReceipt(jobId: string, paymentAmount: number): Promise<void> {
  const admin = createAdminClient()
  const { data: job } = await admin
    .from('jobs')
    .select(`
      id, scheduled_at, total_price, tax_amount, receipt_email_sent_at,
      customer:customers(full_name, email),
      business:businesses(name, brand_color, logo_url, contact_email, timezone, currency, plan, tax_name)
    `)
    .eq('id', jobId)
    .single()

  if (!job) {
    console.error('[webhook] job not found for receipt:', jobId)
    return
  }
  if (job.receipt_email_sent_at) {
    console.log('[webhook] receipt already sent, skipping:', jobId)
    return
  }
  if (!job.customer || !job.business) {
    console.error('[webhook] incomplete job data for receipt:', jobId)
    return
  }

  const result = await sendReceipt({
    job: {
      id: job.id,
      scheduled_at: job.scheduled_at,
      total_price: job.total_price,
      tax_amount: job.tax_amount,
    },
    customer: job.customer,
    business: job.business,
    paymentAmount,
  })

  if (result.success) {
    await admin
      .from('jobs')
      .update({ receipt_email_sent_at: new Date().toISOString() })
      .eq('id', jobId)
  }

  console.log('[webhook] receipt result for job', jobId, ':', result)
}

export async function POST(request: Request) {
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

  const supabase = createClient()

  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const jobId = paymentIntent.metadata?.jobId
        const invoiceId = paymentIntent.metadata?.invoiceId

        if (jobId) {
          await supabase
            .from('jobs')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', jobId)

          await sendJobReceipt(jobId, paymentIntent.amount_received)
        }

        if (invoiceId) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const jobId = paymentIntent.metadata?.jobId

        if (jobId) {
          await supabase
            .from('jobs')
            .update({ payment_status: 'failed' })
            .eq('id', jobId)
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const jobId = session.metadata?.jobId
        const invoiceId = session.metadata?.invoiceId

        if (jobId) {
          await supabase
            .from('jobs')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', jobId)

          await sendJobReceipt(jobId, session.amount_total)
        }

        if (invoiceId) {
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', invoiceId)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
