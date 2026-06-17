// @ts-nocheck
// GET /api/secure-card/validate?token=XXX
// No auth required. Uses service-role client so anon cannot query jobs directly.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      id,
      scheduled_at,
      total_price,
      price_override,
      is_flexible_time,
      payment_status,
      stripe_payment_method_id,
      card_setup_token_expires_at,
      customer:customers(full_name, email),
      business:businesses(name, brand_color, contact_email, stripe_account_id, currency),
      service:services(name)
    `)
    .eq('card_setup_token', token)
    .is('stripe_payment_method_id', null)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
  }

  // Check expiry
  if (job.card_setup_token_expires_at && new Date(job.card_setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
  }

  return NextResponse.json({
    jobId: job.id,
    customerName: job.customer?.full_name,
    customerEmail: job.customer?.email,
    total: job.price_override ?? job.total_price,
    businessName: job.business?.name,
    brandColor: job.business?.brand_color || '#1A6B4A',
    contactEmail: job.business?.contact_email,
    currency: job.business?.currency || 'AUD',
    stripeAccountId: job.business?.stripe_account_id || null,
    serviceName: job.service?.name,
    scheduledAt: job.scheduled_at,
    isFlexibleTime: job.is_flexible_time,
  })
}
