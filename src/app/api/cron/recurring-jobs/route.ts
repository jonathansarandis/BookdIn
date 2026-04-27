// @ts-nocheck
// src/app/api/cron/recurring-jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find active schedules due within the next 24 hours
  const { data: schedules, error } = await supabase
    .from('recurring_schedules')
    .select('*, customer:customers(id, full_name), service:services(name, duration_minutes)')
    .eq('is_active', true)
    .lte('next_scheduled_at', tomorrow.toISOString())
    .is('paused_until', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let jobsCreated = 0

  for (const schedule of schedules || []) {
    // Check if a job already exists for this schedule on this date
    const scheduledDate = new Date(schedule.next_scheduled_at)
    const dayStart = new Date(scheduledDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(scheduledDate)
    dayEnd.setHours(23, 59, 59, 999)

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('customer_id', schedule.customer_id)
      .eq('service_id', schedule.service_id)
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .limit(1)

    if (existingJob?.length) continue // Job already exists

    // Create the job
    const { error: jobError } = await supabase
      .from('jobs')
      .insert({
        business_id: schedule.business_id,
        customer_id: schedule.customer_id,
        service_id: schedule.service_id,
        provider_id: schedule.provider_id || null,
        address_id: schedule.address_id || null,
        status: 'pending',
        scheduled_at: schedule.next_scheduled_at,
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

      // Update next_scheduled_at on the schedule
      const nextDate = getNextDate(new Date(schedule.next_scheduled_at), schedule.frequency)
      await supabase
        .from('recurring_schedules')
        .update({ next_scheduled_at: nextDate.toISOString() })
        .eq('id', schedule.id)
    }
  }

  return NextResponse.json({
    message: `Recurring jobs cron completed`,
    schedules_checked: schedules?.length || 0,
    jobs_created: jobsCreated,
  })
}
