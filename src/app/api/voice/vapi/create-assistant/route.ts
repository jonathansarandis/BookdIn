// @ts-nocheck
// src/app/api/voice/vapi/create-assistant/route.ts
//
// Creates (or updates, if businesses.vapi_assistant_id already exists) the
// Vapi assistant for a business, built from its services/pricing/location/
// voice settings. Triggered from the Voice Agent settings card.
//
// NOTE ON VAPI CONFIG SHAPE: written without a live Vapi API key to verify
// field names against, so the turn-taking options (backchannelingEnabled,
// responseDelaySeconds, startSpeakingPlan.waitSeconds) reflect the most
// commonly documented Vapi assistant schema. If Vapi rejects any of these
// fields, the fix is isolated to buildVapiAssistantPayload() below.
// (fillerInjectionEnabled was removed here — Vapi dropped it from voice
// provider configs in their Nov 2024 update.)
//
// transcriber / backgroundSpeechDenoisingPlan / stopSpeakingPlan /
// startSpeakingPlan.smartEndpointingPlan were added later (Aug 2026, "Aria
// can't hear me" reports) and cross-checked against Vapi's current docs at
// the time — backgroundDenoisingEnabled specifically was deprecated in favor
// of backgroundSpeechDenoisingPlan, so don't reintroduce the old flat field.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildVapiAssistantPayload, buildVapiRealtimePayload } from '@/lib/voice/ariaAssistant'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Prompt template, tool definitions, and both the live (cascaded) and test
// (OpenAI Realtime) payload builders now live in src/lib/voice/ariaAssistant.ts
// so this route and create-test-assistant/route.ts can never drift out of sync.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { business_id } = body
  if (!business_id) return NextResponse.json({ error: 'business_id is required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile || profile.business_id !== business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.VAPI_API_KEY) {
    return NextResponse.json({ error: 'VAPI_API_KEY is not configured on the server' }, { status: 500 })
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd-in.vercel.app'

  const { data: business, error: bizErr } = await admin.from('businesses').select('*').eq('id', business_id).single()
  if (bizErr || !business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const [{ data: services }, { data: locations }] = await Promise.all([
    admin.from('services').select('id, name, base_price, pricing_type').eq('business_id', business_id),
    admin.from('locations').select('id, name').eq('business_id', business_id).eq('is_active', true),
  ])

  // voice_engine controls which architecture the LIVE assistant runs — 'cascaded'
  // (Claude + 11labs + Deepgram, the long-standing default) or 'realtime'
  // (OpenAI's native speech-to-speech model). This PATCHes the same
  // vapi_assistant_id your phone number is already assigned to, so flipping
  // voice_engine + clicking "Update assistant" takes effect immediately without
  // any SIP/phone-number reassignment.
  const payload = business.voice_engine === 'realtime'
    ? buildVapiRealtimePayload(business, services || [], locations || [], appUrl, business.voice_realtime_voice_id || 'marin')
    : buildVapiAssistantPayload(business, services || [], locations || [], appUrl)

  let isUpdate = !!business.vapi_assistant_id
  let vapiRes = await fetch(
    isUpdate ? `https://api.vapi.ai/assistant/${business.vapi_assistant_id}` : 'https://api.vapi.ai/assistant',
    {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  // A stored vapi_assistant_id that 404s means it doesn't exist under whatever account
  // VAPI_API_KEY currently points to — most likely the key was swapped/corrected since
  // that ID was saved (e.g. it pointed at the wrong Vapi account originally). Rather than
  // fail outright, fall back to creating a fresh assistant under the current key so
  // "Create assistant" self-heals instead of needing a manual DB fix every time.
  if (isUpdate && vapiRes.status === 404) {
    console.warn(`[create-assistant] Stored vapi_assistant_id ${business.vapi_assistant_id} not found under current VAPI_API_KEY — creating a new assistant instead.`)
    isUpdate = false
    vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  }

  const vapiData = await vapiRes.json().catch(() => null)
  if (!vapiRes.ok) {
    console.error('[create-assistant] Vapi API error:', vapiRes.status, vapiData)
    return NextResponse.json({ error: vapiData?.message || `Vapi API error (${vapiRes.status})` }, { status: 502 })
  }

  const assistantId = vapiData?.id || business.vapi_assistant_id
  if (assistantId && assistantId !== business.vapi_assistant_id) {
    await admin.from('businesses').update({ vapi_assistant_id: assistantId }).eq('id', business_id)
  }

  return NextResponse.json({ success: true, assistant_id: assistantId })
}
