// @ts-nocheck
// POST /api/google-ads/backfill-conversions  { since?: 'YYYY-MM-DD' }
// Uploads every completed, paid, not-yet-uploaded job for the signed-in user's business
// (using gclid when present, hashed email/phone otherwise). Idempotent.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncJobConversionToGoogleAds } from '@/lib/googleAdsConversions'

export const maxDuration = 300

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile?.business_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let since = '2026-08-15'
  try { const b = await req.json(); if (b?.since) since = b.since } catch {}

  const admin = createAdminClient()
  const { data: jobs } = await admin
    .from('jobs')
    .select('id')
    .eq('business_id', profile.business_id)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .is('parent_job_id', null)
    .is('conversion_uploaded_at', null)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(300)

  const summary: Record<string, number> = {}
  for (const j of jobs ?? []) {
    const r = await syncJobConversionToGoogleAds(j.id)
    const k = r.uploaded ? 'uploaded' : (r.reason || 'failed')
    summary[k] = (summary[k] || 0) + 1
  }
  return NextResponse.json({ considered: jobs?.length ?? 0, summary })
}
