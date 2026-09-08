// @ts-nocheck
// src/app/api/jobs/[id]/cancel-series/route.ts
//
// "Cancel this + every future booking in the same recurring series" — the direct
// follow-up to the location_id schema-drift bug fixed earlier today. That bug meant
// recurring schedules silently failed to materialize for a long time, and once it
// was fixed and backfilled, some customers ended up with duplicate/overlapping
// bookings on the calendar (one set from whatever manual workaround staff used
// while it was broken, one set from the newly-working schedule). Staff need a way
// to clean up an entire duplicate series in one click, from the job page itself,
// rather than hunting down every individual occurrence by hand.
//
// Mirrors the existing "Cancel schedule" logic already on /recurring (which only
// covers schedules that show up in that list) — this route works from any job,
// including ones from a schedule-less/orphaned recurring job (frequency set but no
// recurring_schedule_id, matched by customer+service instead).
//
// Soft-cancel, not hard-delete: sets status='cancelled' rather than removing rows,
// consistent with every other cancel action in this app (financial/audit records
// stay intact, and the calendar already filters out cancelled jobs — see
// calendar/page.tsx's `.neq('status', 'cancelled')` — so a cancelled duplicate
// disappears from the calendar immediately either way).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const NON_CANCELLABLE_STATUSES = ['completed', 'cancelled']

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await admin
    .from('jobs')
    .select('id, business_id, customer_id, service_id, recurring_schedule_id, status, customer:customers(full_name)')
    .eq('id', params.id)
    .single()
  if (!job || job.business_id !== businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  let cancelledJobIds: string[] = []

  if (job.recurring_schedule_id) {
    // Has a real schedule — cancel every future, non-terminal job on it (this one
    // included, regardless of its own date), then deactivate the schedule so
    // nothing re-materializes it tomorrow.
    const { data: cancelled, error: cancelErr } = await admin
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('recurring_schedule_id', job.recurring_schedule_id)
      .not('status', 'in', `(${NON_CANCELLABLE_STATUSES.join(',')})`)
      .select('id')
    if (cancelErr) return NextResponse.json({ error: cancelErr.message }, { status: 500 })
    cancelledJobIds = (cancelled || []).map(j => j.id)

    await admin.from('jobs').update({ status: 'cancelled' }).eq('id', job.id) // covers past-dated ones the query above may have excluded on a race
    if (!cancelledJobIds.includes(job.id)) cancelledJobIds.push(job.id)

    await admin.from('recurring_schedules').delete().eq('id', job.recurring_schedule_id)
  } else {
    // Orphaned recurring job — frequency was set but (per the bug just fixed) no
    // schedule row ever got created for it. No recurring_schedule_id to key off,
    // so fall back to matching future jobs for the same customer + service, same
    // fallback the /recurring page's own cancel action already uses for jobs
    // created before that link existed.
    const { data: cancelled, error: cancelErr } = await admin
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('business_id', businessId)
      .eq('customer_id', job.customer_id)
      .eq('service_id', job.service_id)
      .is('recurring_schedule_id', null)
      .gte('scheduled_at', nowIso)
      .not('status', 'in', `(${NON_CANCELLABLE_STATUSES.join(',')})`)
      .select('id')
    if (cancelErr) return NextResponse.json({ error: cancelErr.message }, { status: 500 })
    cancelledJobIds = (cancelled || []).map(j => j.id)

    if (!cancelledJobIds.includes(job.id) && !NON_CANCELLABLE_STATUSES.includes(job.status)) {
      await admin.from('jobs').update({ status: 'cancelled' }).eq('id', job.id)
      cancelledJobIds.push(job.id)
    }
  }

  await admin.from('activity_logs').insert({
    business_id: businessId,
    event_type: 'booking_series_cancelled',
    description: `Cancelled recurring series (${cancelledJobIds.length} booking${cancelledJobIds.length === 1 ? '' : 's'}) for ${job.customer?.full_name || 'customer'}`,
    entity_type: 'job',
    entity_id: job.id,
  })

  return NextResponse.json({ cancelled_count: cancelledJobIds.length, cancelled_job_ids: cancelledJobIds })
}
