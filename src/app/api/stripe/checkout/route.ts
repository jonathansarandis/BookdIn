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

    const { jobId, invoiceId } = await request.json()

    // Get business info
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()

    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', profile?.business_id)
      .single()

    let amount = 0
    let description = 'Service payment'
    let customerEmail = ''
    let returnPath = '/jobs'

    if (jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('*, customer:customers(full_name, email), service:services(name)')
        .eq('id', jobId)
        .single()

      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

      amount = job.total_price || 0
      description = `${job.service?.name || 'Service'} - ${business?.name || 'BookdIn'}`
      customerEmail = job.customer?.email || ''
      returnPath = `/jobs/${jobId}`
    }

    if (invoiceId) {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*, customer:customers(full_name, email)')
        .eq('id', invoiceId)
        .single()

      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

      amount = invoice.total || 0
      description = `Invoice #${invoice.invoice_number} - ${business?.name || 'BookdIn'}`
      customerEmail = invoice.customer?.email || ''
      returnPath = `/invoices/${invoiceId}`
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail || undefined,
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
      metadata: {
        jobId: jobId || '',
        invoiceId: invoiceId || '',
        businessId: profile?.business_id || '',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
