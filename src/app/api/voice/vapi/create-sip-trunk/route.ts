// @ts-nocheck
// src/app/api/voice/vapi/create-sip-trunk/route.ts
//
// Connects a business's existing Dialpad number to Vapi over a BYO SIP trunk:
//   1. Create (or update) a `byo-sip-trunk` credential in Vapi from the SIP
//      username/password/domain/port saved on the business.
//   2. Create (or update) a Vapi phone number linked to that credential, using
//      the business's existing voice_phone_number as the number.
//   3. Assign the business's Aria assistant (vapi_assistant_id) to that phone
//      number.
//   4. Store the returned credential id and phone number id on `businesses`.
//
// Triggered by the "Connect via SIP" button on the Voice Agent settings card,
// after the SIP credentials fields have been saved.
//
// NOTE ON VAPI CONFIG SHAPE: written without a live Vapi API key to verify
// field names against. The `gateways` / `outboundAuthenticationPlan` shape
// below reflects Vapi's documented BYO SIP trunk credential schema as of this
// writing. If Vapi rejects any of these fields, the fix is isolated to
// buildSipCredentialPayload() / buildPhoneNumberPayload() below — the error
// message returned from Vapi is passed straight through in the response.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildSipCredentialPayload(business: any, sipPassword: string) {
  return {
    provider: 'byo-sip-trunk',
    name: `${business.name} — Dialpad SIP trunk`,
    gateways: [
      { ip: business.voice_sip_domain, port: business.voice_sip_port || 5060 },
    ],
    outboundAuthenticationPlan: {
      authUsername: business.voice_sip_username,
      authPassword: sipPassword,
    },
  }
}

function buildPhoneNumberPayload(business: any, credentialId: string) {
  return {
    provider: 'byo-sip-trunk',
    credentialId,
    number: business.voice_phone_number,
    numberE164CheckEnabled: false,
    name: `${business.name} — Dialpad`,
  }
}

async function vapiFetch(path: string, method: string, body: any) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

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

  const { data: business, error: bizErr } = await admin.from('businesses').select('*').eq('id', business_id).single()
  if (bizErr || !business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  if (!business.vapi_assistant_id) {
    return NextResponse.json({ error: 'Create the voice assistant before connecting a SIP trunk' }, { status: 400 })
  }
  if (!business.voice_sip_username || !business.voice_sip_password_encrypted || !business.voice_sip_password_iv || !business.voice_sip_domain) {
    return NextResponse.json({ error: 'Save your SIP username, password, and domain before connecting' }, { status: 400 })
  }
  if (!business.voice_phone_number) {
    return NextResponse.json({ error: 'Enter the phone number customers call before connecting' }, { status: 400 })
  }

  let sipPassword: string
  try {
    sipPassword = decrypt(business.voice_sip_password_encrypted, business.voice_sip_password_iv)
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to decrypt SIP password: ${err.message}` }, { status: 500 })
  }

  // 1. SIP trunk credential
  const credentialPayload = buildSipCredentialPayload(business, sipPassword)
  const isCredentialUpdate = !!business.vapi_sip_credential_id
  const credentialRes = await vapiFetch(
    isCredentialUpdate ? `/credential/${business.vapi_sip_credential_id}` : '/credential',
    isCredentialUpdate ? 'PATCH' : 'POST',
    credentialPayload
  )
  if (!credentialRes.ok) {
    console.error('[create-sip-trunk] Vapi credential error:', credentialRes.status, credentialRes.data)
    return NextResponse.json({ error: credentialRes.data?.message || `Vapi credential error (${credentialRes.status})` }, { status: 502 })
  }
  const credentialId = credentialRes.data?.id || business.vapi_sip_credential_id

  // 2. Phone number linked to that trunk
  const phoneNumberPayload = buildPhoneNumberPayload(business, credentialId)
  const isPhoneNumberUpdate = !!business.vapi_sip_phone_number_id
  const phoneNumberRes = await vapiFetch(
    isPhoneNumberUpdate ? `/phone-number/${business.vapi_sip_phone_number_id}` : '/phone-number',
    isPhoneNumberUpdate ? 'PATCH' : 'POST',
    phoneNumberPayload
  )
  if (!phoneNumberRes.ok) {
    console.error('[create-sip-trunk] Vapi phone-number error:', phoneNumberRes.status, phoneNumberRes.data)
    return NextResponse.json({ error: phoneNumberRes.data?.message || `Vapi phone-number error (${phoneNumberRes.status})` }, { status: 502 })
  }
  const phoneNumberId = phoneNumberRes.data?.id || business.vapi_sip_phone_number_id

  // 3. Assign the Aria assistant to that phone number
  const assignRes = await vapiFetch(`/phone-number/${phoneNumberId}`, 'PATCH', {
    assistantId: business.vapi_assistant_id,
  })
  if (!assignRes.ok) {
    console.error('[create-sip-trunk] Vapi assistant assignment error:', assignRes.status, assignRes.data)
    return NextResponse.json({ error: assignRes.data?.message || `Vapi assistant assignment error (${assignRes.status})` }, { status: 502 })
  }

  // 4. Persist Vapi ids
  await admin.from('businesses').update({
    vapi_sip_credential_id: credentialId,
    vapi_sip_phone_number_id: phoneNumberId,
  }).eq('id', business_id)

  return NextResponse.json({ success: true, credential_id: credentialId, phone_number_id: phoneNumberId })
}
