// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      business_id,
      sms_provider,
      sms_api_key,        // optional plaintext
      sms_user_id,
      sms_from_number,
      sms_template,
      sms_enabled,
    } = body

    if (!business_id) {
      return NextResponse.json({ error: 'Missing business_id' }, { status: 400 })
    }

    // Verify caller owns this business
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single()
    if (!profile || profile.business_id !== business_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {
      sms_provider: sms_provider || null,
      sms_user_id: sms_user_id || null,
      sms_from_number: sms_from_number || null,
      sms_template: sms_template || null,
      sms_enabled: !!sms_enabled,
    }

    // Only encrypt + persist API key if a new one was sent
    if (sms_api_key) {
      try {
        const { ciphertext, iv } = encrypt(sms_api_key)
        updates.sms_api_key_encrypted = ciphertext
        updates.sms_api_key_iv = iv
      } catch (err: any) {
        return NextResponse.json({ error: `encryption failed: ${err.message}` }, { status: 500 })
      }
    }

    const { error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', business_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('SMS settings POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
