// @ts-nocheck
// Uploads a completed job's outcome back to Google Ads as an offline
// conversion, so Google Ads (and Smart Bidding, if pointed at this
// conversion action) can tell a paying customer apart from a lead who never
// proceeded or cancelled — the specific goal Jonathan asked for. Nothing is
// uploaded for cancelled/no-show jobs; they simply never produce a
// conversion, which is enough on its own to stop those leads being counted
// as wins.
//
// This goes through Google's Data Manager API (events:ingest), not the
// Google Ads API's ConversionUploadService. As of June 15, 2026 Google
// blocks *new* integrations from uploading click conversions through the
// legacy Google Ads API endpoint — every upload attempt through it fails
// with an INVALID_ARGUMENT telling the caller to move to the Data Manager
// API. Since this pipeline started calling that endpoint after the cutoff,
// every single upload was silently rejected (see conversion_upload_error on
// affected jobs) until this rewrite.
//
// The Data Manager API needs a *different* OAuth scope
// (https://www.googleapis.com/auth/datamanager) than the Google Ads API
// scope (adwords) used for reporting. A business's existing refresh token —
// minted before this scope was added to the connect flow's SCOPE — does NOT
// carry it; Google bakes granted scopes into the token at consent time, so
// getAccessToken() will happily return a token that works for reporting but
// gets rejected here. Each business must reconnect Google Ads once (Settings
// → Google Ads → Reconnect) after this ships, to re-grant consent with the
// wider scope.
import { createAdminClient } from '@/lib/supabase/admin'
import {
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
 * The Data Manager API's `productDestinationId` wants the bare numeric
 * conversion action ID — not the "customers/.../conversionActions/123"
 * resource name the old Google Ads API endpoint used. Accepts either, in
 * case Jonathan has a full resource name pasted into settings from before.
 */
function bareConversionActionId(conversionActionIdOrResourceName: string): string {
  const trimmed = conversionActionIdOrResourceName.trim()
  const parts = trimmed.split('/')
  return parts[parts.length - 1]
}

async function uploadClickConversion(
  business: BusinessGoogleAdsConfig,
  opts: { gclid: string; conversionActionId: string; conversionDateTime: Date; conversionValue: number; currencyCode: string; orderId: string },
): Promise<{ success: boolean; error?: string }> {
  const creds = decryptGoogleAdsCredentials(business)
  const accessToken = await getAccessToken(creds)
  const customerId = business.google_ads_customer_id!.replace(/-/g, '')

  const destination: Record<string, any> = {
    operatingAccount: { accountId: customerId, accountType: 'GOOGLE_ADS' },
    productDestinationId: bareConversionActionId(opts.conversionActionId),
  }
  if (business.google_ads_login_customer_id) {
    destination.loginAccount = {
      accountId: business.google_ads_login_customer_id.replace(/-/g, ''),
      accountType: 'GOOGLE_ADS',
    }
  }

  const body = {
    destinations: [destination],
    events: [
      {
        transactionId: opts.orderId, // job id — lets Google dedupe retries
        eventTimestamp: opts.conversionDateTime.toISOString(), // RFC 3339, e.g. 2026-08-26T23:07:22.220Z
        adIdentifiers: { gclid: opts.gclid },
        currency: opts.currencyCode,
        conversionValue: opts.conversionValue,
      },
    ],
  }

  const res = await fetch('https://datamanager.googleapis.com/v1/events:ingest', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    return { success: false, error: `Data Manager API request failed (${res.status}): ${text.slice(0, 1500)}` }
  }

  // Unlike the old endpoint's partialFailure model, the Data Manager API
  // fast-fails: any request that reaches a 2xx was accepted for processing.
  // fieldWarnings are non-fatal per-field notices, not failures — worth
  // logging but not worth treating as an upload failure.
  const data = await res.json().catch(() => ({}))
  if (Array.isArray(data.fieldWarnings) && data.fieldWarnings.length > 0) {
    console.warn('[uploadClickConversion] Data Manager API field warnings:', JSON.stringify(data.fieldWarnings).slice(0, 500))
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
    conversionDateTime: conversionDate,
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

/**
 * Given a job that just had a card captured (payment_status -> 'card_on_file',
 * i.e. the customer actually booked and put a card down — not merely
 * submitted a lead form), looks up its gclid and uploads a SEPARATE
 * conversion to Google Ads under google_ads_booking_conversion_action_id.
 *
 * This is intentionally a distinct conversion action from the job-completion
 * one above: Jonathan wants Google to be able to tell a lead who books and
 * pays apart from one who merely fills out a form, without waiting weeks for
 * the job itself to be completed. Firing this early is a much faster signal
 * back to Smart Bidding than the completion-based conversion.
 *
 * Best-effort and idempotent — safe to call more than once for the same job
 * (a second call is a no-op once booking_conversion_uploaded_at is set), and
 * never throws; every failure mode is returned as a result plus recorded on
 * the job row for visibility. Called from both places a card can actually
 * get captured (POST /api/secure-card/save, and the setup_intent.succeeded
 * webhook fallback for 3DS redirects) so it fires exactly once regardless of
 * which path completes the capture.
 */
export async function syncBookingConversionToGoogleAds(jobId: string): Promise<SyncResult> {
  const admin = createAdminClient()

  const { data: job } = await admin
    .from('jobs')
    .select('id, business_id, customer_id, payment_status, price, total_price, created_at, booking_conversion_uploaded_at')
    .eq('id', jobId)
    .single()

  if (!job) return { uploaded: false, reason: 'job_not_found' }
  // Any of these means a real card is on record for this booking — either
  // saved for later (card_on_file), already put on hold (authorized), or
  // already charged (paid). 'pending'/no card yet doesn't count.
  if (!['card_on_file', 'authorized', 'paid'].includes(job.payment_status)) {
    return { uploaded: false, reason: 'card_not_captured' }
  }
  if (job.booking_conversion_uploaded_at) return { uploaded: false, reason: 'already_uploaded' }

  const { data: business } = await admin
    .from('businesses')
    .select('google_ads_customer_id, google_ads_enabled, google_ads_developer_token_encrypted, google_ads_developer_token_iv, google_ads_refresh_token_encrypted, google_ads_refresh_token_iv, google_ads_login_customer_id, google_ads_booking_conversion_action_id')
    .eq('id', job.business_id)
    .single()

  if (!business || !isGoogleAdsConfigured(business) || !business.google_ads_booking_conversion_action_id) {
    return { uploaded: false, reason: 'google_ads_not_configured' }
  }

  // Same lookup order as the completion sync: booking-level gclid first
  // (more precise for repeat customers with different gclids per booking),
  // falling back to the customer-level one.
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
  // Conversion date is "now" (the moment the card was captured), not
  // created_at — the conversion should timestamp the paid/booked moment
  // Google is being told about, matching what actually happened.
  const conversionDate = new Date()

  const result = await uploadClickConversion(business, {
    gclid,
    conversionActionId: business.google_ads_booking_conversion_action_id,
    conversionDateTime: conversionDate,
    conversionValue: conversionValueCents / 100,
    currencyCode: 'AUD',
    orderId: jobId,
  })

  if (result.success) {
    await admin.from('jobs').update({ booking_conversion_uploaded_at: new Date().toISOString(), booking_conversion_upload_error: null }).eq('id', jobId)
    return { uploaded: true }
  }

  await admin.from('jobs').update({ booking_conversion_upload_error: result.error?.slice(0, 2000) }).eq('id', jobId)
  return { uploaded: false, reason: 'upload_failed', error: result.error }
}
