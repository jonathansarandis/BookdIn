import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingConfirmation } from '@/lib/email'

// @supabase/ssr v0.5 column-select generics return `never` for columns outside
// the generated snapshot. We cast each query result explicitly rather than using
// @ts-nocheck — this is the correct escape hatch for this Supabase version.

interface ProfileCheck {
  business_id: string | null
}

interface JobAuthCheck {
  business_id: string
  confirmation_email_sent_at: string | null
}

interface JobEmailRow {
  id: string
  scheduled_at: string
  total_price: number
  tax_amount: number
  payment_status: string | null
  customer: { full_name: string; email: string } | null
  service: { name: string } | null
  address: { line1: string; city: string; state: string; postcode: string } | null
  business: {
    name: string
    brand_color: string | null
    logo_url: string | null
    contact_email: string | null
    timezone: string
    stripe_onboarded: boolean
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
  //    and check idempotency in the same query
  const { data: rawJobCheck } = await supabase
    .from('jobs')
    .select('business_id, confirmation_email_sent_at')
    .eq('id', params.id)
    .single()
  const jobCheck = rawJobCheck as unknown as JobAuthCheck | null

  if (!jobCheck || jobCheck.business_id !== profile?.business_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 4. Idempotency: already sent — skip silently
  if (jobCheck.confirmation_email_sent_at) {
    return NextResponse.json({ success: true, alreadySent: true })
  }

  // 5. Fetch full job data via admin client for email assembly
  const admin = createAdminClient()
  const { data: rawJob } = await admin
    .from('jobs')
    .select(`
      id, scheduled_at, total_price, tax_amount, payment_status,
      customer:customers(full_name, email),
      service:services(name),
      address:addresses(line1, city, state, postcode),
      business:businesses(name, brand_color, logo_url, contact_email, timezone, stripe_onboarded)
    `)
    .eq('id', params.id)
    .single()

  if (!rawJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const job = rawJob as unknown as JobEmailRow

  if (!job.customer || !job.service || !job.address || !job.business) {
    return NextResponse.json({ error: 'Job data incomplete' }, { status: 500 })
  }

  const cardSetupUrl = (job.payment_status !== 'paid' && job.business.stripe_onboarded)
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${params.id}/card-setup`
    : undefined

  const result = await sendBookingConfirmation({
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
    cardSetupUrl,
  })

  // 6. Mark sent — prevents duplicate sends if caller retries
  if (result.success) {
    // Supabase's Update generic resolves to `never` for columns outside the snapshot;
    // casting the table ref to any is the minimal escape hatch — only this call is affected.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsTable: any = admin.from('jobs')
    await jobsTable.update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', params.id)
  }

  return NextResponse.json(result)
}
