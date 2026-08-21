// @ts-nocheck
// src/app/api/voice/vapi/create-test-assistant/route.ts
//
// Creates (or updates) a *separate* Vapi assistant running OpenAI's Realtime
// speech-to-speech model, so it can be A/B tested against the live Aria
// (cascaded Claude + 11labs + Deepgram, see create-assistant/route.ts)
// without ever touching businesses.vapi_assistant_id or the phone number
// customers actually call. Its id is stored on businesses.vapi_test_assistant_id.
//
// Triggered from the "Test: OpenAI Realtime voice" section on the Voice
// Agent settings card. Config shape cross-checked against Vapi's live
// "OpenAI Realtime" docs (Aug 2026) — see buildVapiRealtimePayload() in
// src/lib/voice/ariaAssistant.ts for the field-by-field reasoning.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildVapiRealtimePayload } from '@/lib/voice/ariaAssistant'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REALTIME_VOICE_IDS = ['alloy', 'echo', 'shimmer', 'marin', 'cedar']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { business_id, voice_id } = body
  if (!business_id) return NextResponse.json({ error: 'business_id is required' }, { status: 400 })

  const voiceId = REALTIME_VOICE_IDS.includes(voice_id) ? voice_id : 'marin'

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

  const payload = buildVapiRealtimePayload(business, services || [], locations || [], appUrl, voiceId)

  let isUpdate = !!business.vapi_test_assistant_id
  let vapiRes = await fetch(
    isUpdate ? `https://api.vapi.ai/assistant/${business.vapi_test_assistant_id}` : 'https://api.vapi.ai/assistant',
    {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  // Same self-healing behaviour as the live-assistant route: a stored id that
  // 404s means it doesn't exist under the current VAPI_API_KEY, so create fresh
  // rather than fail outright.
  if (isUpdate && vapiRes.status === 404) {
    console.warn(`[create-test-assistant] Stored vapi_test_assistant_id ${business.vapi_test_assistant_id} not found — creating a new test assistant instead.`)
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
    console.error('[create-test-assistant] Vapi API error:', vapiRes.status, vapiData)
    return NextResponse.json({ error: vapiData?.message || `Vapi API error (${vapiRes.status})` }, { status: 502 })
  }

  const assistantId = vapiData?.id || business.vapi_test_assistant_id
  if (assistantId && assistantId !== business.vapi_test_assistant_id) {
    await admin.from('businesses').update({ vapi_test_assistant_id: assistantId }).eq('id', business_id)
  }

  return NextResponse.json({ success: true, assistant_id: assistantId, voice_id: voiceId })
}
