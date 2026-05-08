// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderConfirmationHtml } from '@/lib/email/templates'
import { DEFAULT_BOOKING_CONFIRMATION_BODY } from '@/lib/email/defaultTemplates'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'No business' }, { status: 403 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('name, brand_color, logo_url, contact_email, timezone, plan, currency, cancellation_fee_cents, cancellation_cutoff')
    .eq('id', profile.business_id)
    .single()

  const { body: incomingBody } = await request.json()
  const templateBody: string = typeof incomingBody === 'string' ? incomingBody : DEFAULT_BOOKING_CONFIRMATION_BODY

  const cancellationFeeCents: number = business?.cancellation_fee_cents ?? 5000
  const cancellationCutoff: string  = business?.cancellation_cutoff ?? '5 PM'
  const businessName: string        = business?.name ?? 'Your Business'

  const sampleVars: Record<string, string> = {
    customer_name:       'Jonathan Test',
    service_name:        'Move In Clean',
    date:                'Friday, 15 May 2026',
    arrival_time:        '9:00 AM',
    address:             '220 Spencer St, Melbourne VIC 3000',
    subtotal:            '$179.00',
    gst:                 '$17.90',
    total:               '$196.90',
    business_name:       businessName,
    cancellation_fee:    `$${(cancellationFeeCents / 100).toFixed(0)}`,
    cancellation_cutoff: cancellationCutoff,
  }

  const businessData = {
    name:          businessName,
    brand_color:   business?.brand_color ?? '#1A6B4A',
    logo_url:      business?.logo_url ?? null,
    contact_email: business?.contact_email ?? null,
    timezone:      business?.timezone ?? 'Australia/Melbourne',
    plan:          business?.plan ?? null,
    currency:      business?.currency ?? 'AUD',
  }

  const sampleJob = {
    id: 'preview-00000000',
    scheduled_at: new Date('2026-05-15T23:00:00Z').toISOString(),
    total_price: 19690,
    tax_amount: 1790,
    is_flexible_time: false,
  }

  const html = renderConfirmationHtml(
    templateBody,
    sampleVars,
    businessData,
    sampleJob,
    { name: 'Move In Clean' },
    { line1: '220 Spencer St', city: 'Melbourne', state: 'VIC', postcode: '3000' },
    'https://example.com/secure-card/preview-token-00000000',
  )

  return NextResponse.json({ html })
}
