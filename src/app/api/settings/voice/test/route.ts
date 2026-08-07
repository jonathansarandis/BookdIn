// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { business_id, to_phone } = body
  if (!to_phone) return NextResponse.json({ error: 'to_phone is required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile || profile.business_id !== business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: business } = await supabase.from('businesses').select('vapi_assistant_id').eq('id', business_id).single()
  if (!business?.vapi_assistant_id) {
    return NextResponse.json({ error: 'No voice assistant configured yet — save your settings first to create one.' }, { status: 400 })
  }
  if (!process.env.VAPI_API_KEY || !process.env.VAPI_PHONE_NUMBER_ID) {
    return NextResponse.json({ error: 'Voice calling is not configured on the server yet.' }, { status: 500 })
  }

  const vapiRes = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: business.vapi_assistant_id,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: to_phone },
    }),
  })

  const vapiData = await vapiRes.json().catch(() => null)
  if (!vapiRes.ok) {
    return NextResponse.json({ error: vapiData?.message || `Vapi API error (${vapiRes.status})` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, message: 'Test call started — your phone should ring shortly', call_id: vapiData?.id })
}
