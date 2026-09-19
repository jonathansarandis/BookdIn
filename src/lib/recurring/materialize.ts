// src/lib/recurring/materialize.ts
//
// Shared core of "turn active recurring_schedules rows into real jobs rows on the calendar,
// keeping a rolling window of future occurrences materialized." Used by both:
//   - the daily cron (src/app/api/cron/recurring-jobs/route.ts) — runs for every business
//   - the admin-triggered manual sync (src/app/api/recurring/sync/route.ts) — one business,
//     so a business doesn't have to wait for the next 8am cron tick to see the fix take
//     effect, and can re-run it on demand if something looks off.
//
// REWRITE (2026-09-02): the previous version walked a single forward-only cursor
// (recurring_schedules.next_scheduled_at) that, once advanced past a date, never
// revisited it. That meant a job that was later cancelled, rescheduled to a
// different date, or hard-deleted left a PERMANENT gap — nothing ever noticed or
// backfilled it, because the cursor had already moved on. Worse, the dedup check
// was customer+service+date only, with no status filter, so even a cancelled job
// counted as "this week is handled" forever. That's exactly how a real customer's
// weekly clean silently vanished off the calendar after a reschedule/cancellation
// touched that one occurrence — every other week was fine, which is why it looked
// "fixed" for months before failing once.
//
// This version has no mutable cursor to drift out of sync with reality. Every run,
// for every active schedule, it re-derives the full set of expected occurrence
// dates from an IMMUTABLE anchor_date (set once at schedule creation, never
// touched again) and reconciles that against whatever non-cancelled jobs actually
// exist right now, within a small tolerance window per date (so a job the
// business rescheduled by a few days still counts as covering that slot instead
// of spawning a duplicate). Any expected date with nothing covering it — for
// whatever reason: cancelled, deleted, never created, cron didn't run that day —
// gets a replacement job created for it, every single run. Self-healing by
// construction instead of by trusting a pointer.
import type { SupabaseClient } from '@supabase/supabase-js'

// Rolling buffer, not a hard cutoff — callers re-run this regularly (daily cron, or
// on-demand) and it always tops schedules back up to `now + HORIZON_DAYS`, so future
// bookings never visibly run out for as long as a schedule stays active.
export const HORIZON_DAYS = 90
// How far back from "now" to actually check for gaps. Expected dates are still
// phase-locked to the schedule's true anchor_date (so day-of-week/day-of-month
// never drifts), but there's no need to re-walk a weekly schedule's entire
// history every run — a gap that's already older than this would have been
// caught by an earlier run. Comfortably wider than any realistic "we noticed
// late" window.
export const LOOKBACK_DAYS = 30
// Safety cap on occurrences reconciled for a single schedule in one call.
const MAX_OCCURRENCES_PER_RUN = 40

// anchorDay is no longer used for 'monthly' (kept as a param for call-site
// compatibility) — the business wants "Monthly" to mean a strict 4-week
// (28-day) rotation, not calendar-month arithmetic. Same fixed-interval
// pattern as 'weekly'/'fortnightly', just a longer interval, so there's no
// month-length clamping/drift concern to begin with.
export function getNextDate(current: Date, frequency: string, anchorDay?: number): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'weekly':      next.setDate(next.getDate() + 7); break
    case 'fortnightly': next.setDate(next.getDate() + 14); break
    case 'monthly':     next.setDate(next.getDate() + 28); break
  }
  return next
}

// Half the interval (roughly), capped — a job moved within this many days of
// its expected date still counts as covering that occurrence. Wide enough to
// absorb a normal reschedule, narrow enough that two genuinely separate
// occurrences of a weekly schedule can never be mistaken for one.
export function toleranceMs(frequency: string): number {
  const days = frequency === 'weekly' ? 3 : frequency === 'fortnightly' ? 5 : 10
  return days * 24 * 60 * 60 * 1000
}

// Shared with the one-off monthly-drift backfill (src/app/api/recurring/fix-monthly-drift)
// so both this reconciliation loop and that backfill walk the exact same phase-locked
// sequence from anchor_date — two independent implementations of "what dates should
// exist" is exactly the kind of drift that caused the original bug.
export function computeExpectedDates(anchorDate: Date, frequency: string, now: Date): Date[] {
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
  const lookbackFloor = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const anchorDay = anchorDate.getDate()

  let cursor = new Date(anchorDate)
  let skipGuard = 0
  while (cursor < lookbackFloor && skipGuard < 1000) {
    cursor = getNextDate(cursor, frequency, anchorDay)
    skipGuard++
  }

  const expectedDates: Date[] = []
  let occurrenceGuard = 0
  while (cursor <= horizon && occurrenceGuard < MAX_OCCURRENCES_PER_RUN) {
    expectedDates.push(new Date(cursor))
    cursor = getNextDate(cursor, frequency, anchorDay)
    occurrenceGuard++
  }
  return expectedDates
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

  // Deliberately NOT filtered by next_scheduled_at anymore — that field is no
  // longer load-bearing for correctness (see file header), so a schedule
  // whose pointer already raced ahead of a since-cancelled job must still be
  // re-checked every run, not skipped.
  let query = supabase
    .from('recurring_schedules')
    .select('*, service:services(name, duration_minutes)')
    .eq('is_active', true)
    .is('paused_until', null)

  if (opts.businessId) query = query.eq('business_id', opts.businessId)

  const { data: schedules, error } = await query
  if (error) throw new Error(error.message)

  let jobsCreated = 0
  let schedulesTopped = 0

  for (const schedule of schedules || []) {
    const anchor = new Date(schedule.anchor_date || schedule.next_scheduled_at || schedule.created_at)
    const anchorDay = anchor.getDate()

    const expectedDates = computeExpectedDates(anchor, schedule.frequency, now)
    if (expectedDates.length === 0) continue

    const tolerance = toleranceMs(schedule.frequency)
    const windowStart = new Date(expectedDates[0].getTime() - tolerance)

    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('id, scheduled_at')
      .eq('recurring_schedule_id', schedule.id)
      .neq('status', 'cancelled')
      .gte('scheduled_at', windowStart.toISOString())
      .lte('scheduled_at', horizon.toISOString())

    const claimed = new Set<string>()
    let furthest = expectedDates[0]

    for (const expected of expectedDates) {
      const match = (existingJobs || []).find(j =>
        !claimed.has(j.id) &&
        Math.abs(new Date(j.scheduled_at).getTime() - expected.getTime()) <= tolerance
      )

      if (match) {
        claimed.add(match.id)
        furthest = new Date(match.scheduled_at)
        continue
      }

      // Gap: no non-cancelled job anywhere near this expected date. Fill it —
      // this is what recovers a booking that was cancelled/deleted/rescheduled
      // away without ever having its slot backfilled.
      const { error: jobError } = await supabase
        .from('jobs')
        .insert({
          business_id: schedule.business_id,
          // location_id: same schema-drift NOT NULL column as recurring_schedules
          // (see migrations/20260908_document_recurring_schedules_location_id.sql)
          // — jobs.location_id is also NOT NULL on the live DB and also missing
          // from tracked schema.sql/migrations. Every job insert here was failing
          // this constraint, silently swallowed by the catch below: schedules were
          // (once the recurring_schedules fix landed) finally being created
          // successfully, but every one of their future occurrences failed to
          // insert, so nothing ever showed up on the calendar. schedule.location_id
          // is already in scope from the `select('*', ...)` above.
          location_id: schedule.location_id,
          customer_id: schedule.customer_id,
          service_id: schedule.service_id,
          provider_id: schedule.provider_id || null,
          address_id: schedule.address_id || null,
          recurring_schedule_id: schedule.id,
          status: 'pending',
          scheduled_at: expected.toISOString(),
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
        furthest = expected
      } else {
        console.error(`[recurring-materialize] Failed to create job for schedule ${schedule.id} on ${expected.toISOString()}:`, jobError.message)
      }
    }

    // next_scheduled_at is kept updated purely for display on /recurring —
    // it's no longer read back in as a source of truth by this function.
    const nextAfterFurthest = getNextDate(furthest, schedule.frequency, anchorDay)
    if (nextAfterFurthest.toISOString() !== schedule.next_scheduled_at) {
      await supabase
        .from('recurring_schedules')
        .update({ next_scheduled_at: nextAfterFurthest.toISOString() })
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
