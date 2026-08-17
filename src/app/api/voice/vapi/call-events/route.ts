// @ts-nocheck
// src/app/api/voice/vapi/call-events/route.ts
//
// Vapi call-lifecycle webhook (call started, status changes, end-of-call
// report with transcript/recording). Upserts into voice_calls keyed on
// vapi_call_id, so whichever event arrives first creates the row and later
// events just fill in more fields — order isn't guaranteed by Vapi.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { resolveBusinessByAssistantId, resolveBusinessByPhoneNumber, extractCallInfo } from '@/lib/voice/shared'
import { upsertCrmContact, logCrmActivity } from '@/lib/crm/upsert'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const { data: savedRow, error } = await admin
    .from('voice_calls')
    .upsert(row, { onConflict: 'vapi_call_id' })
    .select('id, booking_id, transcript, duration_seconds, phone_number_from')
    .single()
  if (error) console.error('[vapi call-events] upsert failed:', error.message)

  // Only at true call end, and only for calls with a real conversation (skip near-instant
  // hangups/misdials — no point burning an LLM call or creating a CRM lead off silence).
  if (type === 'end-of-call-report' && savedRow?.transcript && (savedRow.duration_seconds ?? 0) >= 15) {
    await extractNotesAndUpsertLead(savedRow, business.id)
  }

  return NextResponse.json({ received: true })
}

/**
 * End-of-call pass: summarizes the transcript into a short actionable note for the team
 * (shown above the transcript on the call detail page and surfaced in the AI Agent
 * widget until reviewed), and puts the caller into the CRM as a lead if the call didn't
 * already result in a booking. Bookings already get a proper CRM upsert with real
 * structured customer data from handleCreateBooking (src/app/api/voice/vapi/route.ts) —
 * this only fills the gap for inquiry-only and transferred calls, which previously never
 * touched the CRM at all. Best-effort: never throws back to the Vapi webhook caller.
 */
async function extractNotesAndUpsertLead(
  savedRow: { id: string; booking_id: string | null; transcript: string; phone_number_from: string | null },
  businessId: string,
) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Transcript of a phone call answered by an AI booking assistant for a cleaning business. Extract:
1. The caller's name if they mentioned it, else null.
2. A 1-2 sentence actionable note for the team: what the caller wanted, any objection or hesitation, and what follow-up (if any) is needed. If a booking was already confirmed on the call, say so plainly instead of implying follow-up is needed.

Respond with ONLY valid JSON, no other text: {"caller_name": string|null, "notes": string}

Transcript:
${savedRow.transcript.slice(0, 8000)}`,
      }],
    })
    const text = msg.content.find((b: any) => b.type === 'text')?.text || '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')
    const callerName: string | null = parsed.caller_name || null
    const notes: string | null = parsed.notes || null

    if (notes) {
      await admin.from('voice_calls').update({ caller_name: callerName, actionable_notes: notes }).eq('id', savedRow.id)
    }

    if (!savedRow.booking_id && savedRow.phone_number_from) {
      const fullName = callerName || `Caller ${savedRow.phone_number_from.slice(-4)}`
      const crmResult = await upsertCrmContact(admin, {
        business_id: businessId,
        customer_id: null,
        full_name: fullName,
        email: null,
        phone: savedRow.phone_number_from,
        source: 'voice',
      })
      if (crmResult.contact_id && notes) {
        await logCrmActivity(admin, {
          business_id: businessId,
          contact_id: crmResult.contact_id,
          type: 'note',
          title: crmResult.created ? 'Phone inquiry via Aria (new lead)' : 'Phone inquiry via Aria',
          body: notes,
        })
      }
    }
  } catch (e: any) {
    console.error('[vapi call-events] notes/CRM extraction failed (non-blocking):', e.message)
  }
}
