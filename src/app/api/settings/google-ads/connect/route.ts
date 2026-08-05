// @ts-nocheck
// GET /api/settings/google-ads/connect
// Kicks off the Google OAuth consent screen for Google Ads read access.
// Mirrors /api/stripe/connect: look up the caller's business, redirect to the
// provider, and carry business_id through as `state` so the callback knows
// which row to update.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPE = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/auth/login`)
  }

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile?.business_id) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=business_not_found`)
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/settings?google_ads_error=oauth_not_configured`)
  }

  const redirectUri = `${appUrl}/api/settings/google-ads/callback`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent') // force a refresh_token even on repeat connects
  authUrl.searchParams.set('state', profile.business_id)

  return NextResponse.redirect(authUrl.toString())
}
