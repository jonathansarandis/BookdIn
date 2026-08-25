// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncJobConversionToGoogleAds } from '@/lib/googleAdsConversions'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  assigned:    ['in_progress'],
  on_the_way:  ['in_progress'],
  in_progress: ['completed'],
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let status: string
  try {
    const body = await req.json()
    status = body.status
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const admin = createAdminClient()

  // Identify this user's provider record — providers are not in profiles
  const { data: provider, error: provErr } = await admin
    .from('providers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (provErr || !provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 403 })
  }

  // Verify job is assigned to this provider — explicit ownership check before write
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, status')
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
