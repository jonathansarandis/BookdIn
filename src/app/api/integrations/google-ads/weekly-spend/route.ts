// @ts-nocheck
// GET /api/integrations/google-ads/weekly-spend?week_start=YYYY-MM-DD
// Returns { configured: false } (200) when Google Ads isn't connected yet, so the
// /reports/profit page can show a "Connect Google Ads" prompt instead of an error.
// On success: { configured: true, spend: { melbourne, perth, adelaide, sydney } } —
// dollars, matching the shape requested for this endpoint.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isGoogleAdsConfigured, getWeeklySpendByLocation } from '@/lib/googleAds'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('week_start')
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'week_start must be YYYY-MM-DD (Monday)' }, { status: 400 })
  }
  const weekEndInclusive = new Date(`${weekStart}T00:00:00Z`)
  weekEndInclusive.setUTCDate(weekEndInclusive.getUTCDate() + 6)
  const weekEndStr = weekEndInclusive.toISOString().slice(0, 10)

  const { data: business } = await supabase
    .from('businesses')
    .select('google_ads_customer_id, google_ads_enabled, google_ads_developer_token_encrypted, google_ads_developer_token_iv, google_ads_refresh_token_encrypted, google_ads_refresh_token_iv, google_ads_login_customer_id')
    .eq('id', businessId)
    .single()

  if (!business || !isGoogleAdsConfigured(business)) {
    return NextResponse.json({ configured: false })
  }

  try {
    const spend = await getWeeklySpendByLocation(business, weekStart, weekEndStr)
    return NextResponse.json({ configured: true, spend })
  } catch (err: any) {
    console.error('[google-ads/weekly-spend] failed:', err.message)
    return NextResponse.json({ configured: true, error: err.message || 'Google Ads request failed' }, { status: 502 })
  }
}
