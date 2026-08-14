// @ts-nocheck
// src/app/api/cron/recurring-jobs/route.ts
//
// Daily entrypoint for materializeRecurringJobs (src/lib/recurring/materialize.ts) — the
// core logic that turns active recurring_schedules rows into real `jobs` rows on the
// calendar, across every business. See that file for the rolling-horizon explanation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { materializeRecurringJobs } from '@/lib/recurring/materialize'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await materializeRecurringJobs(supabase)
    return NextResponse.json({
      message: 'Recurring jobs cron completed',
      schedules_checked: result.schedulesChecked,
      schedules_topped_up: result.schedulesToppedUp,
      jobs_created: result.jobsCreated,
      horizon_days: result.horizonDays,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
