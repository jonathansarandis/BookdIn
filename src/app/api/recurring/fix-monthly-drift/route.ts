// @ts-nocheck
// src/app/api/recurring/fix-monthly-drift/route.ts
//
// One-off backfill for the "monthly" recurrence bug: materialize.ts's getNextDate()
// used to add a calendar month (Sep 15 -> Oct 15) instead of a fixed 28-day interval,
// so every already-materialized future job on a 'monthly' recurring_schedules row was
// inserted on the wrong date. The getNextDate() fix itself only affects occurrences
// generated from now on — it does nothing for rows already sitting in `jobs` with the
// old, wrong dates. This route finds and corrects those specific rows.
//
// GET  -> dry run. Reports every job whose current scheduled_at doesn't line up with
//         the correct 28-day-from-anchor cadence, and what it would be corrected to.
//         Makes no changes.
// POST { confirm: true } -> applies exactly the corrections the dry run reported,
//         logs one activity_logs entry per corrected job, then runs the normal
//         materialize pass so any real gaps get topped up and next_scheduled_at is
//         refreshed. Scoped to the caller's own business only, same as /api/recurring/sync.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeExpectedDates, toleranceMs, materializeRecurringJobs } from '@/lib/recurring/materialize'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getBusinessId() {
  const cookieClient = createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return null
  const { data: profile } = await serviceClient
    .from('profiles').select('business_id').eq('id', user.id).single()
  return profile?.business_id || null
}

// Figures out which existing jobs on a schedule are already on a correct 28-day-from-
// -anchor date (leave alone) vs which are drifted (need correcting), and pairs each
// drifted job with the nearest not-yet-claimed correct slot, in date order. Pairing by
// order rather than "closest date" avoids two drifted jobs swapping onto each other's
// nearest slot when they're close together.
function diffSchedule(schedule: any, existingJobs: { id: string; scheduled_at: string; status: string }[], now: Date) {
  const anchor = new Date(schedule.anchor_date)
  const expectedDates = computeExpectedDates(anchor, 'monthly', now)
  const tolerance = toleranceMs('monthly')

  const claimed = new Set<string>()
  for (const expected of expectedDates) {
    const match = existingJobs.find(j =>
      !claimed.has(j.id) &&
      Math.abs(new Date(j.scheduled_at).getTime() - expected.getTime()) <= tolerance
    )
    if (match) claimed.add(match.id)
  }

  const drifted = existingJobs
    .filter(j => !claimed.has(j.id))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const freeSlots = expectedDates
    .filter(d => !existingJobs.some(j => claimed.has(j.id) && Math.abs(new Date(j.scheduled_at).getTime() - d.getTime()) <= tolerance))
    .sort((a, b) => a.getTime() - b.getTime())

  const corrections: { jobId: string; oldScheduledAt: string; newScheduledAt: string }[] = []
  for (let i = 0; i < drifted.length && i < freeSlots.length; i++) {
    const job = drifted[i]
    const target = freeSlots[i]
    const orig = new Date(job.scheduled_at)
    // Keep the job's own time-of-day (staff may have set a specific window) —
    // only the calendar date is wrong, so only the date part gets corrected.
    const corrected = new Date(target)
    corrected.setUTCHours(orig.getUTCHours(), orig.getUTCMinutes(), orig.getUTCSeconds(), orig.getUTCMilliseconds())
    corrections.push({
      jobId: job.id,
      oldScheduledAt: job.scheduled_at,
      newScheduledAt: corrected.toISOString(),
    })
  }

  // Drifted jobs with no free slot to pair with (more drifted jobs than gaps —
  // shouldn't normally happen, but surface it rather than silently drop it) are
  // reported separately so nothing gets swept under the rug.
  const unresolved = drifted.slice(freeSlots.length).map(j => j.id)

  return { corrections, unresolved }
}

async function buildReport(businessId: string) {
  const now = new Date()

  const { data: schedules, error } = await serviceClient
    .from('recurring_schedules')
    .select('id, anchor_date, customer_id, is_active, customer:customers(full_name)')
    .eq('business_id', businessId)
    .eq('frequency', 'monthly')
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const report: any[] = []
  let totalCorrections = 0
  let totalUnresolved = 0

  for (const schedule of schedules || []) {
    const { data: existingJobs } = await serviceClient
      .from('jobs')
      .select('id, scheduled_at, status')
      .eq('recurring_schedule_id', schedule.id)
      .neq('status', 'cancelled')
      .gte('scheduled_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const { corrections, unresolved } = diffSchedule(schedule, existingJobs || [], now)
    if (corrections.length === 0 && unresolved.length === 0) continue

    totalCorrections += corrections.length
    totalUnresolved += unresolved.length
    report.push({
      scheduleId: schedule.id,
      customer: (schedule as any).customer?.full_name || schedule.customer_id,
      corrections,
      unresolvedJobIds: unresolved,
    })
  }

  return { schedulesAffected: report.length, totalCorrections, totalUnresolved, report }
}

export async function GET() {
  const businessId = await getBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await buildReport(businessId)
    return NextResponse.json({ dryRun: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const businessId = await getBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== true) {
    return NextResponse.json({ error: 'POST requires { "confirm": true } to apply changes. Use GET first to review.' }, { status: 400 })
  }

  const { data: { user } } = await createClient().auth.getUser()

  try {
    const { report, totalCorrections } = await buildReport(businessId)

    let applied = 0
    for (const scheduleEntry of report) {
      for (const c of scheduleEntry.corrections) {
        const { error: updateError } = await serviceClient
          .from('jobs')
          .update({ scheduled_at: c.newScheduledAt })
          .eq('id', c.jobId)

        if (updateError) {
          console.error(`[fix-monthly-drift] Failed to correct job ${c.jobId}:`, updateError.message)
          continue
        }
        applied++

        await serviceClient.from('activity_logs').insert({
          business_id: businessId,
          actor_id: user?.id || null,
          actor_name: 'Monthly recurrence drift backfill',
          event_type: 'recurring_monthly_drift_corrected',
          description: `Corrected drifted monthly recurring job date from ${c.oldScheduledAt} to ${c.newScheduledAt} (was scheduled under the old calendar-month logic)`,
          metadata: { schedule_id: scheduleEntry.scheduleId, old_scheduled_at: c.oldScheduledAt, new_scheduled_at: c.newScheduledAt },
          entity_type: 'job',
          entity_id: c.jobId,
        })
      }
    }

    // Top up any real gaps and refresh next_scheduled_at cursors now that the
    // drifted rows are corrected.
    const materializeResult = await materializeRecurringJobs(serviceClient, { businessId })

    return NextResponse.json({
      success: true,
      correctionsApplied: applied,
      correctionsPlanned: totalCorrections,
      materialize: materializeResult,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
