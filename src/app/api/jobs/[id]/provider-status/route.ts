// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    .update({ status })
    .eq('id', params.id)
    .eq('provider_id', provider.id)

  if (updateError) {
    console.error(`[provider-status] Update failed for job ${params.id}:`, updateError.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  console.log(`[provider-status] job ${params.id} → ${status} (provider ${provider.id})`)
  return NextResponse.json({ success: true, status })
}
