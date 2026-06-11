// @ts-nocheck
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

  let price_override: number | null
  try {
    const body = await req.json()
    price_override = body.price_override ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (price_override !== null) {
    if (!Number.isInteger(price_override) || price_override <= 0) {
      return NextResponse.json({ error: 'price_override must be a positive integer (cents)' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Ownership check — only fetch if job belongs to operator's business
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
    .update({ price_override })
    .eq('id', params.id)
    .eq('business_id', profile.business_id)

  if (updateError) {
    console.error(`[price-override] DB update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  console.log(`[price-override] job ${params.id} → price_override=${price_override}`)
  return NextResponse.json({ success: true, price_override })
}
