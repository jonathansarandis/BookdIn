// @ts-nocheck
// Shared bits for the persistent, no-password provider portal login.
//
// Replaces Supabase Auth (signInWithPassword / invite+magiclink / password
// setup) for providers entirely. A provider gets ONE link —
// /provider/portal/[token] — built from providers.portal_token, a random
// token with no expiry (see migrations/20260901_provider_portal_token.sql).
// Visiting it sets a long-lived cookie; every provider-facing route below
// resolves identity from that cookie instead of a Supabase session. This
// mirrors the card_setup_token pattern already used for Stripe card links
// (src/app/api/secure-card/validate/route.ts): plain service-role lookup by
// token, no signing, no session machinery.
export const PORTAL_COOKIE = 'provider_portal_token'
export const PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/**
 * Resolve the provider identified by the portal cookie on this request.
 * Returns null if there's no cookie, or the token doesn't match any provider
 * (e.g. it was regenerated/revoked). Callers should fall back to the legacy
 * Supabase Auth session check for any provider who still has an old
 * password-based account — this doesn't replace that, just adds the new path.
 */
export async function getProviderFromPortalCookie(cookieStore, admin, select = 'id, display_name, color, is_active, payout_percent, business_id') {
  const token = cookieStore.get(PORTAL_COOKIE)?.value
  if (!token) return null
  const { data } = await admin.from('providers').select(select).eq('portal_token', token).maybeSingle()
  return data ?? null
}
