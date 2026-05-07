import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCancellation } from '@/lib/email'

interface ProfileCheck {
  business_id: string | null
}

interface JobAuthCheck {
  business_id: string
  status: string
  cancellation_email_sent_at: string | null
}

interface JobCancelRow {
  id: string
  scheduled_at: string
  total_price: number
  tax_amount: number
  business_id: string
  customer: { full_name: string; email: string } | null
  service: { name: string } | null
  address: { line1: string; city: string; state: string; postcode: string } | null
  business: {
    name: string
    brand_color: string | null
    logo_url: string | null
    contact_email: string | null
    timezone: string
    currency: string
    plan: string
    tax_name: string | null
  } | null
}

export async function POST(
  _: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient()

  // 1. Require authenticated session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get caller's business_id
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as ProfileCheck | null

  // 3. Verify job belongs to caller's business (404 avoids leaking job existence)
  const { data: rawJobCheck } = await supabase
    .from('jobs')
    .select('business_id, status, cancellation_email_sent_at')
    .eq('id', params.id)
    .single()
  const jobCheck = rawJobCheck as unknown as JobAuthCheck | null

  if (!jobCheck || jobCheck.business_id !== profile?.business_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const alreadyCancelled = jobCheck.status === 'cancelled'
  const emailAlreadySent = !!jobCheck.cancellation_email_sent_at

  // 4. Status action: only update + log if not already cancelled
  if (!alreadyCancelled) {
    await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', params.id)

    await supabase.from('activity_logs').insert({
      business_id: jobCheck.business_id,
      event_type: 'booking_cancelled',
      description: 'Booking cancelled',
      entity_type: 'job',
      entity_id: params.id,
    })
  }

  // 5. Email action: independent of status — send if column is null
  if (emailAlreadySent) {
    return NextResponse.json({
      success: true,
      alreadyCancelled,
      emailStatus: 'already_sent',
    })
  }

  // 6. Fetch full job data for cancellation email
  const admin = createAdminClient()
  const { data: rawJob } = await admin
    .from('jobs')
    .select(`
      id, scheduled_at, total_price, tax_amount, business_id,
      customer:customers(full_name, email),
      service:services(name),
      address:addresses(line1, city, state, postcode),
      business:businesses(name, brand_color, logo_url, contact_email, timezone, currency, plan, tax_name)
    `)
    .eq('id', params.id)
    .single()

  if (!rawJob) {
    return NextResponse.json({ success: true, alreadyCancelled, emailStatus: 'failed' })
  }

  const job = rawJob as unknown as JobCancelRow

  if (!job.customer || !job.service || !job.address || !job.business) {
    return NextResponse.json({ success: true, alreadyCancelled, emailStatus: 'failed' })
  }

  // 7. Send cancellation email
  const result = await sendCancellation({
    job: {
      id: job.id,
      scheduled_at: job.scheduled_at,
      total_price: job.total_price,
      tax_amount: job.tax_amount,
    },
    customer: job.customer,
    business: job.business,
    address: job.address,
    service: job.service,
  })

  // 8. Mark sent on success
  if (result.success) {
    await admin
      .from('jobs')
      .update({ cancellation_email_sent_at: new Date().toISOString() })
      .eq('id', params.id)
  }

  return NextResponse.json({
    success: true,
    alreadyCancelled,
    emailStatus: result.success ? 'sent' : 'failed',
  })
}
