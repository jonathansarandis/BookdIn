import type { SupabaseClient } from '@supabase/supabase-js'

// _getAccessToken() re-reads the session on every request and refreshes it if
// it's within its expiry margin — but that's a best-effort background race,
// not a guarantee. A request that lands exactly as the token goes stale (or
// while a refresh triggered by another tab is still in flight) gets rejected
// or silently scoped to the anon role by RLS, which renders as "no data"
// rather than an error. Retrying once against a freshly-refreshed session
// closes that window instead of making the user reload the page.
export async function withSessionRetry<T>(
  supabase: SupabaseClient,
  run: () => PromiseLike<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> {
  const first = await run()
  if (!first.error) return first

  const { data: { session } } = await supabase.auth.refreshSession()
  if (!session) return first

  return run()
}
