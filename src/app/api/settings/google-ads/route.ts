// @ts-nocheck
// src/app/api/settings/google-ads/route.ts
// Same shape as /api/settings/sms: only touches the encrypted credential blob
// when the caller actually sent new values, and reports back whether
// credentials are configured (never the values themselves, once saved).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

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
      client_id,
      client_secret,
      refresh_token,
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

    const anyCredentialProvided = developer_token || client_id || client_secret || refresh_token
    if (anyCredentialProvided) {
      // Merge with whatever's already stored so a partial update (e.g. just rotating
      // the refresh token) doesn't blank out the other three fields.
      let existing: Record<string, string> = {}
      const { data: current } = await supabase
        .from('businesses')
        .select('google_ads_credentials_encrypted, google_ads_credentials_iv')
        .eq('id', business_id)
        .single()
      if (current?.google_ads_credentials_encrypted && current?.google_ads_credentials_iv) {
        try {
          existing = JSON.parse(decrypt(current.google_ads_credentials_encrypted, current.google_ads_credentials_iv))
        } catch (err: any) {
          return NextResponse.json({ error: `Could not decrypt existing credentials: ${err.message}` }, { status: 500 })
        }
      }

      const merged = {
        developer_token: developer_token || existing.developer_token || '',
        client_id: client_id || existing.client_id || '',
        client_secret: client_secret || existing.client_secret || '',
        refresh_token: refresh_token || existing.refresh_token || '',
      }

      try {
        const { ciphertext, iv } = encrypt(JSON.stringify(merged))
        updates.google_ads_credentials_encrypted = ciphertext
        updates.google_ads_credentials_iv = iv
      } catch (err: any) {
        return NextResponse.json({ error: `Encryption failed: ${err.message}` }, { status: 500 })
      }
    }

    const { error } = await supabase.from('businesses').update(updates).eq('id', business_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Google Ads settings POST error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
