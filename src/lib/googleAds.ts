import { decrypt } from '@/lib/crypto'

export interface GoogleAdsCredentials {
  developer_token: string
  client_id: string
  client_secret: string
  refresh_token: string
}

export interface BusinessGoogleAdsConfig {
  google_ads_customer_id: string | null
  google_ads_enabled: boolean
  google_ads_developer_token_encrypted: string | null
  google_ads_developer_token_iv: string | null
  google_ads_refresh_token_encrypted: string | null
  google_ads_refresh_token_iv: string | null
  google_ads_login_customer_id?: string | null
}

const API_VERSION = 'v24'

function getOAuthClientCredentials(): { client_id: string; client_secret: string } {
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!client_id || !client_secret) {
    throw new Error('GOOGLE_ADS_CLIENT_ID/GOOGLE_ADS_CLIENT_SECRET are not set in environment')
  }
  return { client_id, client_secret }
}

export function isGoogleAdsConfigured(business: BusinessGoogleAdsConfig): boolean {
  return !!(
    business.google_ads_enabled &&
    business.google_ads_customer_id &&
    business.google_ads_developer_token_encrypted &&
    business.google_ads_developer_token_iv &&
    business.google_ads_refresh_token_encrypted &&
    business.google_ads_refresh_token_iv
  )
}

export function decryptGoogleAdsCredentials(business: BusinessGoogleAdsConfig): GoogleAdsCredentials {
  const developer_token = decrypt(business.google_ads_developer_token_encrypted!, business.google_ads_developer_token_iv!)
  const refresh_token = decrypt(business.google_ads_refresh_token_encrypted!, business.google_ads_refresh_token_iv!)
  return { developer_token, refresh_token, ...getOAuthClientCredentials() }
}

/**
 * Maps a Google Ads campaign name to one of the four BookdIn locations.
 * Checked in order:
 *   1. The exact known campaign names from the account's current naming convention
 *   2. A fallback substring match on any of the four city names — covers Performance
 *      Max campaigns and any future campaign as long as the location name appears in it
 * Returns null if the campaign name doesn't match any known location (spend from
 * unmapped campaigns is dropped, not silently attributed to the wrong location).
 */
export function mapCampaignToLocation(campaignName: string): 'melbourne' | 'perth' | 'adelaide' | 'sydney' | null {
  const name = campaignName.toLowerCase()

  const exact: Record<string, 'melbourne' | 'perth' | 'adelaide' | 'sydney'> = {
    'residential melbourne': 'melbourne',
    'east melbourne': 'melbourne',
    'residential perth': 'perth',
    'residential adelaide': 'adelaide',
  }
  if (exact[name]) return exact[name]

  if (name.includes('melbourne')) return 'melbourne'
  if (name.includes('perth')) return 'perth'
  if (name.includes('adelaide')) return 'adelaide'
  if (name.includes('sydney')) return 'sydney'
  return null
}

async function getAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    throw new Error(`Google OAuth token refresh failed (${res.status}): ${body.slice(0, 500)}`)
  }
  const data = await res.json()
  if (!data.access_token) throw new Error('Google OAuth token refresh returned no access_token')
  return data.access_token
}

export interface WeeklySpendByLocation {
  melbourne: number
  perth: number
  adelaide: number
  sydney: number
}

/**
 * Pulls per-campaign cost for the given date range and rolls it up by location.
 * Amounts are in dollars (not cents) — matches the shape the profit report's API
 * contract specifies. Never throws for expected failure modes (bad credentials,
 * network errors) — callers should still wrap this, since a malformed customer ID
 * or an unexpected Google Ads response shape can still throw.
 */
export async function getWeeklySpendByLocation(
  business: BusinessGoogleAdsConfig,
  weekStartStr: string, // YYYY-MM-DD, Monday
  weekEndInclusiveStr: string, // YYYY-MM-DD, Sunday
): Promise<WeeklySpendByLocation> {
  const creds = decryptGoogleAdsCredentials(business)
  const accessToken = await getAccessToken(creds)
  const customerId = business.google_ads_customer_id!.replace(/-/g, '')

  const query = `SELECT campaign.name, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${weekStartStr}' AND '${weekEndInclusiveStr}'`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': creds.developer_token,
    'Content-Type': 'application/json',
  }
  // Required whenever the target customer is a client account under a Google Ads
  // Manager (MCC) account — identifies which manager account we're acting through.
  if (business.google_ads_login_customer_id) {
    headers['login-customer-id'] = business.google_ads_login_customer_id.replace(/-/g, '')
  }

  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    throw new Error(`Google Ads API request failed (${res.status}): ${body.slice(0, 800)}`)
  }

  const data = await res.json()
  const results: any[] = data.results || []

  const totals: WeeklySpendByLocation = { melbourne: 0, perth: 0, adelaide: 0, sydney: 0 }
  for (const row of results) {
    const campaignName: string | undefined = row.campaign?.name
    const costMicros: number = Number(row.metrics?.costMicros ?? row.metrics?.cost_micros ?? 0)
    if (!campaignName) continue
    const location = mapCampaignToLocation(campaignName)
    if (!location) continue
    totals[location] += costMicros / 1_000_000
  }

  for (const key of Object.keys(totals) as (keyof WeeklySpendByLocation)[]) {
    totals[key] = Math.round(totals[key] * 100) / 100
  }

  return totals
}
