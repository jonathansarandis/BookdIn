// @ts-nocheck
// src/app/api/settings/google-ads/route.ts
// Handles the parts of Google Ads config that aren't OAuth: the customer ID,
// the enabled flag, and the developer token (a Google Ads API Center value,
// not part of the OAuth handshake, so it's still pasted in manually). The
// refresh token itself is set by /api/settings/google-ads/callback.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      business_id,
      google_ads_customer_id,
      google_ads_enabled,
      developer_token,   // optional plaintext — only present when the user is setting/rotating it
      disconnect,        // optional — clears the refresh token and connected email
    } = body

    if (!business_id) return NextResponse.json({ error: 'Missing business_id' }, { status: 400 })

    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
    if (!profile || profile.business_id !== business_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {
      google_ads_customer_id: google_ads_customer_id || null,
      google_ads_enabled: !!google_ads_enabled,
    }

    if (developer_token) {
      try {
        const { ciphertext, iv } = encrypt(developer_token)
        updates.google_ads_developer_token_encrypted = ciphertext
        updates.google_ads_developer_token_iv = iv
      } catch (err: any) {
        return NextResponse.json({ error: `Encryption failed: ${err.message}` }, { status: 500 })
      }
    }

    if (disconnect) {
      updates.google_ads_refresh_token_encrypted = null
      updates.google_ads_refresh_token_iv = null
      updates.google_ads_connected_email = null
      updates.google_ads_enabled = false
    }

    const { error } = await supabase.from('businesses').update(updates).eq('id', business_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Google Ads settings POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
