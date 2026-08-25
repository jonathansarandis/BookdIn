// @ts-nocheck
// POST /api/jobs/[id]/sync-conversion
// Fired (fire-and-forget, best-effort) right after a job is marked
// 'completed' by any of the admin dashboard's status-update components.
// Looks up the job's gclid and uploads it to Google Ads as an offline
// conversion. Never a hard error for the caller — a business that hasn't
// configured Google Ads, or a booking with no gclid, is an expected no-op,
// not a failure.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncJobConversionToGoogleAds } from '@/lib/googleAdsConversions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile?.business_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: job } = await supabase.from('jobs').select('id, business_id').eq('id', params.id).single()
  if (!job || job.business_id !== profile.business_id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  try {
    const result = await syncJobConversionToGoogleAds(params.id)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error(`[sync-conversion] job ${params.id} failed:`, err.message)
    return NextResponse.json({ uploaded: false, reason: 'unexpected_error', error: err.message }, { status: 200 })
  }
}
