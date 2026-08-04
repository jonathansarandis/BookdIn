// @ts-nocheck
// src/app/api/notify/job-event/route.ts
// Fired by clients right after a job-related action they already performed
// (assign a provider, send a chat message, mark a job complete) to trigger
// a push notification to the other party. Job cancellation instead calls
// notifyJobEvent() directly from /api/jobs/[id]/cancel since that route
// already does the DB write itself server-side.
//
// A flat, non-nested path (rather than /api/jobs/[id]/notify) so it can be
// whitelisted in middleware.ts by exact path — adding a dynamic /api/jobs/*
// path would also expose other job routes that assume middleware auth.
//
// Dual auth (cookie or Bearer), same pattern as /api/providers/accept.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyJobEvent } from '@/lib/push/notifyJobEvent'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const cookieClient = createClient()
  let { data: { user } } = await cookieClient.auth.getUser()

  if (!user) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token) {
      const { data: { user: tokenUser } } = await serviceClient.auth.getUser(token)
      user = tokenUser
    }
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { job_id, event } = body
  if (!job_id || !['assigned', 'completed', 'message'].includes(event)) {
    return NextResponse.json({ error: 'Missing job_id or invalid event' }, { status: 400 })
  }

  const { data: job } = await serviceClient
    .from('jobs').select('business_id, provider_id').eq('id', job_id).single()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Caller must be either the owning business's staff or the provider assigned to this job.
  const [{ data: callerProfile }, { data: callerProvider }] = await Promise.all([
    serviceClient.from('profiles').select('business_id').eq('id', user.id).maybeSingle(),
    serviceClient.from('providers').select('id').eq('user_id', user.id).maybeSingle(),
  ])
  const isOwnerStaff = callerProfile?.business_id === job.business_id
  const isAssignedProvider = callerProvider?.id && callerProvider.id === job.provider_id
  if (!isOwnerStaff && !isAssignedProvider) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (event === 'message') {
    const { sender_role, preview } = body
    if (!['owner', 'provider'].includes(sender_role) || typeof preview !== 'string' || !preview.trim()) {
      return NextResponse.json({ error: 'Missing sender_role or preview' }, { status: 400 })
    }
    await notifyJobEvent(job_id, { event: 'message', senderRole: sender_role, preview: preview.slice(0, 120) })
  } else {
    await notifyJobEvent(job_id, { event })
  }

  return NextResponse.json({ success: true })
}
