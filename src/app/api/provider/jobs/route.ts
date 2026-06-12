// GET /api/provider/jobs
// Returns the authenticated provider's assigned jobs and their own safe profile.
// Payment columns (price, total_price, tax_amount, price_override, provider_fee_extra,
// stripe_*, payment_status) are fetched via admin client for payout computation and
// then stripped before the response is returned — they never reach the client.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProviderPayout } from '@/lib/pricing'

export async function GET() {
  // Cookie-based session set by @supabase/ssr when provider signed in via /provider/login
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Resolve provider — providers are not in profiles, so get_my_business_id() = NULL
  // for them. Use admin client to bypass the business-scoped RLS.
  const { data: provider, error: provErr } = await admin
    .from('providers')
    .select('id, display_name, color, is_active, payout_percent, business_id')
    .eq('user_id', user.id)
    .single()

  if (provErr || !provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 403 })
  }

  // Business tax settings needed for override-aware payout computation
  const { data: business } = await admin
    .from('businesses')
    .select('tax_rate, tax_mode')
    .eq('id', provider.business_id)
    .single()

  const taxRate = Number(business?.tax_rate ?? 0)
  const taxMode = (business?.tax_mode ?? 'exclusive') as 'exclusive' | 'inclusive'

  // Fetch assigned non-cancelled jobs.
  // Payment columns are included here for payout computation only.
  const { data: jobs, error: jobsErr } = await admin
    .from('jobs')
    .select(`
      id,
      scheduled_at,
      status,
      duration_minutes,
      notes,
      customer_notes,
      provider_id,
      bedrooms,
      bathrooms,
      frequency,
      price,
      total_price,
      tax_amount,
      price_override,
      provider_fee_extra,
      customer:customers(full_name, phone, email),
      service:services(name),
      address:addresses(line1, city, state, postcode)
    `)
    .eq('provider_id', provider.id)
    .not('status', 'in', '("cancelled")')
    .order('scheduled_at', { ascending: true })

  if (jobsErr) {
    console.error('[provider/jobs] Query failed:', jobsErr.message)
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 })
  }

  // Compute payout per job, then construct a response object containing ONLY
  // safe fields. Payment columns are intentionally absent from this object.
  const safeJobs = (jobs ?? []).map(job => {
    const payout_cents = getProviderPayout(job, provider, taxRate, taxMode)
    return {
      id: job.id,
      scheduled_at: job.scheduled_at,
      status: job.status,
      duration_minutes: job.duration_minutes,
      notes: job.notes,
      customer_notes: job.customer_notes,
      provider_id: job.provider_id,
      bedrooms: job.bedrooms,
      bathrooms: job.bathrooms,
      frequency: job.frequency,
      payout_cents,
      customer: job.customer,
      service: job.service,
      address: job.address,
    }
  })

  return NextResponse.json({
    provider: {
      id: provider.id,
      display_name: provider.display_name,
      color: provider.color,
      is_active: provider.is_active,
    },
    jobs: safeJobs,
  })
}
