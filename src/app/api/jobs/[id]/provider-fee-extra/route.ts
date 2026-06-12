// @ts-nocheck
// POST /api/jobs/[id]/provider-fee-extra — operator only
// Sets the flat fee extra added to the provider payout for a specific job.
// Follows the same ownership-first pattern as price-override/route.ts.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userClient = createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let provider_fee_extra: number | null
  try {
    const body = await req.json()
    provider_fee_extra = body.provider_fee_extra ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (provider_fee_extra !== null) {
    if (!Number.isInteger(provider_fee_extra) || provider_fee_extra < 0) {
      return NextResponse.json(
        { error: 'provider_fee_extra must be a non-negative integer (cents)' },
        { status: 400 }
      )
    }
  }

  const admin = createAdminClient()

  // Explicit ownership check — 404 on mismatch, never silent no-op
  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id')
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const { error: updateError } = await admin
    .from('jobs')
    .update({ provider_fee_extra })
    .eq('id', params.id)
    .eq('business_id', profile.business_id)

  if (updateError) {
    console.error(`[provider-fee-extra] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  console.log(`[provider-fee-extra] job ${params.id} → provider_fee_extra=${provider_fee_extra}`)
  return NextResponse.json({ success: true, provider_fee_extra })
}
