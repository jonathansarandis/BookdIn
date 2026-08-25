// @ts-nocheck
// Uploads a completed job's outcome back to Google Ads as an offline click
// conversion, so Google Ads (and Smart Bidding, if pointed at this
// conversion action) can tell a paying customer apart from a lead who never
// proceeded or cancelled — the specific goal Jonathan asked for. Nothing is
// uploaded for cancelled/no-show jobs; they simply never produce a
// conversion, which is enough on its own to stop those leads being counted
// as wins.
import { createAdminClient } from '@/lib/supabase/admin'
import {
  API_VERSION,
  decryptGoogleAdsCredentials,
  getAccessToken,
  isGoogleAdsConfigured,
  type BusinessGoogleAdsConfig,
} from '@/lib/googleAds'

export interface SyncResult {
  uploaded: boolean
  reason?: string
  error?: string
}

/**
 * Builds the conversionAction resource name Google Ads' upload endpoint
 * expects. Accepts either the full resource name (if Jonathan pastes it
 * as-is from Google Ads) or just the bare numeric conversion action ID.
 */
function resolveConversionActionResourceName(customerId: string, conversionActionIdOrResourceName: string): string {
  const trimmed = conversionActionIdOrResourceName.trim()
  if (trimmed.includes('/')) return trimmed
  return `customers/${customerId}/conversionActions/${trimmed}`
}

/**
 * Formats a JS Date as the "yyyy-MM-dd HH:mm:ss+00:00" string the Google Ads
 * API requires for conversionDateTime. Always in UTC — Google resolves the
 * actual local time from the offset, so a fixed +00:00 offset is valid even
 * though the business itself isn't in UTC.
 */
function toGoogleAdsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getUTCFullYear()
  const mo = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const h = pad(date.getUTCHours())
  const mi = pad(date.getUTCMinutes())
  const s = pad(date.getUTCSeconds())
  return `${y}-${mo}-${d} ${h}:${mi}:${s}+00:00`
}

async function uploadClickConversion(
  business: BusinessGoogleAdsConfig,
  opts: { gclid: string; conversionActionId: string; conversionDateTime: string; conversionValue: number; currencyCode: string; orderId: string },
): Promise<{ success: boolean; error?: string }> {
  const creds = decryptGoogleAdsCredentials(business)
  const accessToken = await getAccessToken(creds)
  const customerId = business.google_ads_customer_id!.replace(/-/g, '')

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': creds.developer_token,
    'Content-Type': 'application/json',
  }
  if (business.google_ads_login_customer_id) {
    headers['login-customer-id'] = business.google_ads_login_customer_id.replace(/-/g, '')
  }

  const body = {
    conversions: [
      {
        gclid: opts.gclid,
        conversionAction: resolveConversionActionResourceName(customerId, opts.conversionActionId),
        conversionDateTime: opts.conversionDateTime,
        conversionValue: opts.conversionValue,
        currencyCode: opts.currencyCode,
        orderId: opts.orderId, // job id — Google dedupes retries on this
      },
    ],
    partialFailure: true,
  }

  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:uploadClickConversions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    return { success: false, error: `Google Ads API request failed (${res.status}): ${text.slice(0, 800)}` }
  }

  const data = await res.json()
  // partialFailure:true means Google still returns 200 even when the single
  // conversion in this batch fails — the actual per-item error lives in
  // partialFailureError, so a 200 alone doesn't mean success.
  if (data.partialFailureError) {
    return { success: false, error: JSON.stringify(data.partialFailureError).slice(0, 800) }
  }

  return { success: true }
}

/**
 * Given a job that just transitioned to 'completed', looks up its gclid and
 * uploads the conversion to Google Ads. Best-effort and idempotent — safe to
 * call more than once for the same job (a second call is a no-op once
 * conversion_uploaded_at is set), and never throws; every failure mode is
 * returned as a result plus recorded on the job row for visibility.
 */
export async function syncJobConversionToGoogleAds(jobId: string): Promise<SyncResult> {
  const admin = createAdminClient()

  const { data: job } = await admin
    .from('jobs')
    .select('id, business_id, customer_id, status, price, total_price, completed_at, conversion_uploaded_at')
    .eq('id', jobId)
    .single()

  if (!job) return { uploaded: false, reason: 'job_not_found' }
  if (job.status !== 'completed') return { uploaded: false, reason: 'job_not_completed' }
  if (job.conversion_uploaded_at) return { uploaded: false, reason: 'already_uploaded' }

  const { data: business } = await admin
    .from('businesses')
    .select('google_ads_customer_id, google_ads_enabled, google_ads_developer_token_encrypted, google_ads_developer_token_iv, google_ads_refresh_token_encrypted, google_ads_refresh_token_iv, google_ads_login_customer_id, google_ads_conversion_action_id')
    .eq('id', job.business_id)
    .single()

  if (!business || !isGoogleAdsConfigured(business) || !business.google_ads_conversion_action_id) {
    return { uploaded: false, reason: 'google_ads_not_configured' }
  }

  // Booking-level gclid (from lead_sources, keyed by this specific job) is
  // more precise than the customer-level one — a repeat customer can have
  // different gclids across different bookings — so it's tried first.
  let gclid: string | null = null
  const { data: leadSource } = await admin
    .from('lead_sources')
    .select('gclid')
    .eq('booking_id', jobId)
    .maybeSingle()
  if (leadSource?.gclid) gclid = leadSource.gclid

  if (!gclid && job.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('gclid')
      .eq('id', job.customer_id)
      .maybeSingle()
    if (customer?.gclid) gclid = customer.gclid
  }

  if (!gclid) return { uploaded: false, reason: 'no_gclid' } // organic/referral booking — expected, not an error

  const conversionValueCents = job.total_price ?? job.price ?? 0
  const conversionDate = job.completed_at ? new Date(job.completed_at) : new Date()

  const result = await uploadClickConversion(business, {
    gclid,
    conversionActionId: business.google_ads_conversion_action_id,
    conversionDateTime: toGoogleAdsDateTime(conversionDate),
    conversionValue: conversionValueCents / 100,
    currencyCode: 'AUD',
    orderId: jobId,
  })

  if (result.success) {
    await admin.from('jobs').update({ conversion_uploaded_at: new Date().toISOString(), conversion_upload_error: null }).eq('id', jobId)
    return { uploaded: true }
  }

  await admin.from('jobs').update({ conversion_upload_error: result.error?.slice(0, 2000) }).eq('id', jobId)
  return { uploaded: false, reason: 'upload_failed', error: result.error }
}
