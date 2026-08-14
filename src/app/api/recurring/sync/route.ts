// @ts-nocheck
// src/app/api/recurring/sync/route.ts
//
// Lets an admin materialize their business's upcoming recurring bookings on demand,
// instead of waiting for the next 8am cron tick (src/app/api/cron/recurring-jobs) to pick
// up a newly created/edited schedule or a fix that just deployed. Scoped to the caller's
// own business only — this must never let one tenant trigger materialization for another.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { materializeRecurringJobs } from '@/lib/recurring/materialize'

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const cookieClient = createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await serviceClient
    .from('profiles').select('business_id').eq('id', user.id).single()

  if (!profile?.business_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await materializeRecurringJobs(serviceClient, { businessId: profile.business_id })
    return NextResponse.json({
      success: true,
      schedules_checked: result.schedulesChecked,
      jobs_created: result.jobsCreated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
