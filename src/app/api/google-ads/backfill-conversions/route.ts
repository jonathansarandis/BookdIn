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
  let before: string | null = null
  let limit = 20
  try { const b = await req.json(); if (b?.since) since = b.since; if (b?.before) before = b.before; if (b?.limit) limit = Math.min(Number(b.limit) || 20, 40) } catch {}

  const admin = createAdminClient()
  let q = admin
    .from('jobs')
    .select('id, completed_at')
    .eq('business_id', profile.business_id)
    .eq('status', 'completed')
    .eq('payment_status', 'paid')
    .is('parent_job_id', null)
    .is('conversion_uploaded_at', null)
    .gte('completed_at', since)
  if (before) q = q.lt('completed_at', before)
  const { data: jobs } = await q.order('completed_at', { ascending: false }).limit(limit)

  const summary: Record<string, number> = {}
  for (const j of jobs ?? []) {
    const r = await syncJobConversionToGoogleAds(j.id)
    const k = r.uploaded ? 'uploaded' : (r.reason || 'failed')
    summary[k] = (summary[k] || 0) + 1
  }
  const last = jobs && jobs.length ? jobs[jobs.length - 1].completed_at : null
  // Pass `next` back as `before` to continue; null/done=true means finished.
  return NextResponse.json({ considered: jobs?.length ?? 0, summary, next: last, done: !jobs || jobs.length < limit })
}
