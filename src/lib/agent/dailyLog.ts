import type { SupabaseClient } from '@supabase/supabase-js'

/** Business-local calendar date (YYYY-MM-DD) — daily logs are scoped to the business's own day, not UTC. */
export function dateInTimezone(timezone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: timezone || 'Australia/Melbourne' }) // en-CA = YYYY-MM-DD
}

export async function getDailyLog(supabase: SupabaseClient, businessId: string, date: string) {
  const { data } = await supabase
    .from('agent_daily_logs')
    .select('*')
    .eq('business_id', businessId)
    .eq('date', date)
    .maybeSingle()
  return data
}

/**
 * Append one entry to a daily log's jsonb array field (tasks_actioned, messages_sent, outcomes).
 * Atomic via the append_agent_daily_log() Postgres function — creates today's row if it doesn't exist.
 * Best-effort: logs and swallows errors so a logging failure never blocks the underlying action
 * (an SMS that already sent shouldn't fail the request because the log write hiccuped).
 */
export async function appendDailyLogEntry(
  supabase: SupabaseClient,
  businessId: string,
  date: string,
  field: 'tasks_actioned' | 'messages_sent' | 'outcomes',
  entry: Record<string, any>
) {
  const { data, error } = await supabase.rpc('append_agent_daily_log', {
    p_business_id: businessId,
    p_date: date,
    p_field: field,
    p_entry: [{ ...entry, at: entry.at || new Date().toISOString() }],
  })
  if (error) {
    console.error(`[agent daily log] append to ${field} failed:`, error.message)
    return null
  }
  return data
}
