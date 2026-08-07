// @ts-nocheck
// src/app/api/voice/vapi/call-events/route.ts
//
// Vapi call-lifecycle webhook (call started, status changes, end-of-call
// report with transcript/recording). Upserts into voice_calls keyed on
// vapi_call_id, so whichever event arrives first creates the row and later
// events just fill in more fields — order isn't guaranteed by Vapi.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveBusinessByAssistantId, resolveBusinessByPhoneNumber, extractCallInfo } from '@/lib/voice/shared'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STATUS_MAP: Record<string, string> = {
  queued: 'queued',
  ringing: 'ringing',
  'in-progress': 'in_progress',
  forwarding: 'in_progress',
  ended: 'completed',
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const type = body?.message?.type
  const { assistantId, vapiCallId, fromNumber, toNumber } = extractCallInfo(body)

  // Vapi expects a 200 for every event it sends, regardless of whether we
  // could make sense of it — returning an error causes it to retry.
  if (!vapiCallId) return NextResponse.json({ received: true })

  let business = await resolveBusinessByAssistantId(admin, assistantId)
  if (!business) business = await resolveBusinessByPhoneNumber(admin, toNumber)
  if (!business) {
    console.error('[vapi call-events] Could not resolve business for call', vapiCallId)
    return NextResponse.json({ received: true })
  }

  const call = body?.message?.call ?? body?.call ?? {}
  const rawStatus: string | null = call?.status ?? body?.message?.status ?? null

  const row: Record<string, any> = {
    business_id: business.id,
    vapi_call_id: vapiCallId,
  }
  if (fromNumber) row.phone_number_from = fromNumber
  if (toNumber) row.phone_number_to = toNumber
  if (rawStatus) row.status = STATUS_MAP[rawStatus] || rawStatus

  if (type === 'end-of-call-report') {
    const durationSeconds = body?.message?.durationSeconds ?? call?.durationSeconds ?? null
    const transcript = body?.message?.transcript ?? body?.message?.artifact?.transcript ?? null
    const recordingUrl = body?.message?.recordingUrl ?? body?.message?.artifact?.recordingUrl ?? null

    row.status = row.status && row.status !== 'in_progress' ? row.status : 'completed'
    if (durationSeconds != null) row.duration_seconds = Math.round(durationSeconds)
    if (transcript) row.transcript = transcript
    if (recordingUrl) row.recording_url = recordingUrl
    row.ended_at = new Date().toISOString()
  }

  const { error } = await admin.from('voice_calls').upsert(row, { onConflict: 'vapi_call_id' })
  if (error) console.error('[vapi call-events] upsert failed:', error.message)

  return NextResponse.json({ received: true })
}
