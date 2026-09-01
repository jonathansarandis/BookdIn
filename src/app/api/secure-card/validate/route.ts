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

  // NOTE: deliberately NOT filtering on stripe_payment_method_id IS NULL here.
  // That filter used to double as "single-use" enforcement, but it also silently
  // broke every "Replace card manually" / "Generate replacement link" flow —
  // those mint a fresh token specifically for a job that ALREADY has a card on
  // file, so the filter rejected them with a false "Link expired or already
  // used". Single-use is enforced correctly by /api/secure-card/save nulling
  // out card_setup_token on success, which makes this lookup naturally fail
  // for anyone revisiting a consumed link — no separate PM-null check needed.
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
