// @ts-nocheck
// src/app/api/cron/recurring-jobs/route.ts
//
// Materializes upcoming occurrences of active recurring schedules into real `jobs` rows so
// they show up on the calendar. Previously this only created the *single* next occurrence,
// and only once it fell within 24 hours — so a fortnightly/monthly customer only ever had one
// visible booking at a time (see: cleaner portal / calendar bug report, Aug 2026). Fixed to
// keep a rolling window of occurrences materialized ahead of time instead.
//
// HORIZON_DAYS is a rolling buffer, not a hard cutoff — this cron runs daily and always tops
// schedules back up to `now + HORIZON_DAYS`, so from the business's point of view a schedule's
// future bookings never run out for as long as it stays active. That's what gives "indefinite"
// lookahead without ever generating unbounded rows up front.
//
// Also stamps `recurring_schedule_id` on every job it creates (previously never set) so the
// admin UI can reliably bulk-cancel every future booking tied to one schedule in one action.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HORIZON_DAYS = 90
// Safety cap on how many occurrences we'll mint for a single schedule in one run — guards
// against a schedule whose next_scheduled_at somehow got stuck far in the past looping
// unreasonably long. 40 comfortably covers even weekly schedules across the full horizon.
const MAX_OCCURRENCES_PER_RUN = 40

function getNextDate(current: Date, frequency: string): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'weekly':      next.setDate(next.getDate() + 7); break
    case 'fortnightly': next.setDate(next.getDate() + 14); break
    case 'monthly':     next.setMonth(next.getMonth() + 1); break
  }
  return next
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)

  // Every active, non-paused schedule with at least one occurrence due somewhere inside the
  // rolling horizon (not just "due tomorrow" like before).
  const { data: schedules, error } = await supabase
    .from('recurring_schedules')
    .select('*, service:services(name, duration_minutes)')
    .eq('is_active', true)
    .lte('next_scheduled_at', horizon.toISOString())
    .is('paused_until', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
      // skips jobs created by the old version of this cron, which never set that column.
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
          console.error(`[recurring-jobs] Failed to create job for schedule ${schedule.id}:`, jobError.message)
          break // don't advance next_scheduled_at past a failed insert — retry same date tomorrow
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

  return NextResponse.json({
    message: 'Recurring jobs cron completed',
    schedules_checked: schedules?.length || 0,
    schedules_topped_up: schedulesTopped,
    jobs_created: jobsCreated,
    horizon_days: HORIZON_DAYS,
  })
}
