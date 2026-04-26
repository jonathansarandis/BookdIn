import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  try {
    const { jobId, invoiceId } = await request.json()
    const supabase = createAdminClient()

    let amount = 0
    let description = ''
    let customerId = ''
    let customerEmail = ''
    let customerName = ''
    let businessId = ''
    let returnPath = ''

    if (jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('*, customer:customers(*), service:services(name)')
        .eq('id', jobId)
        .single()

      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

      const j = job as any
      amount = j.price
      description = j.service?.name || 'Service'
      customerId = j.customer_id
      customerEmail = j.customer.email
      customerName = j.customer.full_name
      businessId = j.business_id
      returnPath = `/jobs/${jobId}`
    } else if (invoiceId) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*, customer:customers(*)')
        .eq('id', invoiceId)
        .single()

      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

      const inv = invoice as any
      amount = inv.total
      description = `Invoice INV-${invoiceId.slice(0, 8).toUpperCase()}`
      customerId = inv.customer_id
      customerEmail = inv.customer.email
      customerName = inv.customer.full_name
      businessId = inv.business_id
      returnPath = `/invoices/${invoiceId}`
    } else {
      return NextResponse.json({ error: 'jobId or invoiceId required' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}${returnPath}?payment=success`,
      cancel_url: `${appUrl}${returnPath}?payment=cancelled`,
      metadata: { jobId: jobId || '', invoiceId: invoiceId || '', businessId, customerId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
