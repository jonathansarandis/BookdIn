// src/lib/recurring/materialize.ts
//
// Shared core of "turn active recurring_schedules rows into real jobs rows on the calendar,
// keeping a rolling window of future occurrences materialized." Used by both:
//   - the daily cron (src/app/api/cron/recurring-jobs/route.ts) — runs for every business
//   - the admin-triggered manual sync (src/app/api/recurring/sync/route.ts) — one business,
//     so a business doesn't have to wait for the next 8am cron tick to see the fix take
//     effect, and can re-run it on demand if something looks off.
import type { SupabaseClient } from '@supabase/supabase-js'

// Rolling buffer, not a hard cutoff — callers re-run this regularly (daily cron, or
// on-demand) and it always tops schedules back up to `now + HORIZON_DAYS`, so future
// bookings never visibly run out for as long as a schedule stays active.
export const HORIZON_DAYS = 90
// Safety cap on occurrences minted for a single schedule in one call — guards against a
// schedule whose next_scheduled_at somehow got stuck far in the past looping unreasonably
// long. 40 comfortably covers even weekly schedules across the full horizon.
const MAX_OCCURRENCES_PER_RUN = 40

export function getNextDate(current: Date, frequency: string): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'weekly':      next.setDate(next.getDate() + 7); break
    case 'fortnightly': next.setDate(next.getDate() + 14); break
    case 'monthly':     next.setMonth(next.getMonth() + 1); break
  }
  return next
}

export interface MaterializeResult {
  schedulesChecked: number
  schedulesToppedUp: number
  jobsCreated: number
  horizonDays: number
}

export async function materializeRecurringJobs(
  supabase: SupabaseClient,
  opts: { businessId?: string } = {}
): Promise<MaterializeResult> {
  const now = new Date()
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)

  let query = supabase
    .from('recurring_schedules')
    .select('*, service:services(name, duration_minutes)')
    .eq('is_active', true)
    .lte('next_scheduled_at', horizon.toISOString())
    .is('paused_until', null)

  if (opts.businessId) query = query.eq('business_id', opts.businessId)

  const { data: schedules, error } = await query
  if (error) throw new Error(error.message)

  let jobsCreated = 0
  let schedulesTopped = 0

  for (const schedule of schedules || []) {
    let cursor = new Date(schedule.next_scheduled_at)
    let iterations = 0

    while (cursor <= horizon && iterations < MAX_OCCURRENCES_PER_RUN) {
      iterations++

      const dayStart = new Date(cursor); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(cursor); dayEnd.setHours(23, 59, 59, 999)

      // Dedup by customer+service+date (not recurring_schedule_id) so this still correctly
      // skips jobs created before that link was added.
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('customer_id', schedule.customer_id)
        .eq('service_id', schedule.service_id)
        .gte('scheduled_at', dayStart.toISOString())
        .lte('scheduled_at', dayEnd.toISOString())
        .limit(1)

      if (!existingJob?.length) {
        const { error: jobError } = await supabase
          .from('jobs')
          .insert({
            business_id: schedule.business_id,
            customer_id: schedule.customer_id,
            service_id: schedule.service_id,
            provider_id: schedule.provider_id || null,
            address_id: schedule.address_id || null,
            recurring_schedule_id: schedule.id,
            status: 'pending',
            scheduled_at: cursor.toISOString(),
            duration_minutes: schedule.service?.duration_minutes || 120,
            price: schedule.price,
            total_price: schedule.price,
            tax_amount: 0,
            frequency: schedule.frequency,
            notes: schedule.notes || null,
            booking_source: 'recurring',
            payment_method: schedule.auto_charge ? 'card' : 'other',
            payment_status: 'unpaid',
          })

        if (!jobError) {
          jobsCreated++
        } else {
          console.error(`[recurring-materialize] Failed to create job for schedule ${schedule.id}:`, jobError.message)
          break // don't advance next_scheduled_at past a failed insert — retry same date next run
        }
      }

      cursor = getNextDate(cursor, schedule.frequency)
    }

    if (cursor.toISOString() !== schedule.next_scheduled_at) {
      await supabase
        .from('recurring_schedules')
        .update({ next_scheduled_at: cursor.toISOString() })
        .eq('id', schedule.id)
      schedulesTopped++
    }
  }

  return {
    schedulesChecked: schedules?.length || 0,
    schedulesToppedUp: schedulesTopped,
    jobsCreated,
    horizonDays: HORIZON_DAYS,
  }
}
