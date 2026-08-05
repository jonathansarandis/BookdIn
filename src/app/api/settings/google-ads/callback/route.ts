// @ts-nocheck
// GET /api/settings/google-ads/callback
// Exchanges the Google OAuth code for a refresh token and stores it encrypted
// against the business. Mirrors /api/stripe/callback's redirect-back shape.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(request.url)

  const businessId = searchParams.get('state')
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=${encodeURIComponent(oauthError)}`)
  }
  if (!businessId || !code) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=missing_code_or_state`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/auth/login`)
  }

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile || profile.business_id !== businessId) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=business_mismatch`)
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=oauth_not_configured`)
  }

  try {
    const redirectUri = `${appUrl}/api/settings/google-ads/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '<no body>')
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body.slice(0, 500)}`)
    }
    const tokenData = await tokenRes.json()
    if (!tokenData.refresh_token) {
      // Happens if the user has already granted consent before without prompt=consent.
      // /connect always sends prompt=consent so this shouldn't normally trigger.
      throw new Error('Google did not return a refresh token — try reconnecting')
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userInfo = userInfoRes.ok ? await userInfoRes.json().catch(() => ({})) : {}

    const { ciphertext, iv } = encrypt(tokenData.refresh_token)

    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        google_ads_refresh_token_encrypted: ciphertext,
        google_ads_refresh_token_iv: iv,
        google_ads_connected_email: userInfo.email || null,
      })
      .eq('id', businessId)

    if (updateError) throw new Error(updateError.message)

    return NextResponse.redirect(`${appUrl}/settings?google_ads_success=true`)
  } catch (err: any) {
    console.error('Google Ads OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=${encodeURIComponent(err.message)}`)
  }
}
