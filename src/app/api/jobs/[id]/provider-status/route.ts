// @ts-nocheck
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncJobConversionToGoogleAds } from '@/lib/googleAdsConversions'
import { getProviderFromPortalCookie } from '@/lib/providerPortal'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  assigned:    ['in_progress'],
  on_the_way:  ['in_progress'],
  in_progress: ['completed'],
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let status: string
  try {
    const body = await req.json()
    status = body.status
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const admin = createAdminClient()

  // Primary path: persistent portal-token cookie (see /api/provider/jobs for
  // the same pattern). Falls back to a legacy Supabase Auth session.
  let provider = await getProviderFromPortalCookie(cookies(), admin, 'id')

  if (!provider) {
    const userClient = createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: legacyProvider, error: provErr } = await admin
      .from('providers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (provErr || !legacyProvider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 403 })
    }
    provider = legacyProvider
  }

  // Verify job is assigned to this provider — explicit ownership check before write
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, status, scheduled_at, business:businesses(timezone)')
    .eq('id', params.id)
    .eq('provider_id', provider.id)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const allowed = ALLOWED_TRANSITIONS[job.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${job.status}' to '${status}'` },
      { status: 409 }
    )
  }

  // A job accidentally marked 'completed' before its actual service date used to be
  // easy to do (a subcontractor tapped the wrong job) and caused real fallout: it
  // fires the completion conversion upload early and, worse, moves the job into the
  // provider portal's "Completed" tab where it's no longer visible on the upcoming
  // list — so the provider forgets to show up. Compare by calendar date in the
  // business's own timezone (not a raw timestamp diff), so a job scheduled for
  // earlier today can still be completed — only a job whose date hasn't arrived yet
  // is blocked.
  if (status === 'completed' && job.scheduled_at) {
    const tz = job.business?.timezone || 'Australia/Melbourne'
    const jobDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(job.scheduled_at))
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    if (jobDate > todayDate) {
      return NextResponse.json(
        { error: `This job is scheduled for ${jobDate}, which hasn't arrived yet — it can't be marked completed early.` },
        { status: 409 }
      )
    }
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({
      status,
      // The client-side JobStatusUpdater components already stamp this on
      // completion; this route didn't, which left completed_at null for
      // provider-completed jobs. Fixed here so the conversion upload below
      // (and anything else that relies on completed_at) has an accurate time.
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', params.id)
    .eq('provider_id', provider.id)

  if (updateError) {
    console.error(`[provider-status] Update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  console.log(`[provider-status] job ${params.id} → ${status} (provider ${provider.id})`)

  // Best-effort, fire-and-forget: uploads this job's gclid (if any) to
  // Google Ads as an offline conversion. Never blocks the response.
  if (status === 'completed') {
    syncJobConversionToGoogleAds(params.id).catch(err =>
      console.error(`[provider-status] conversion sync failed for job ${params.id}:`, err.message)
    )
  }

  return NextResponse.json({ success: true, status })
}
