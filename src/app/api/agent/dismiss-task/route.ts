// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { appendDailyLogEntry, dateInTimezone } from '@/lib/agent/dailyLog'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { taskId, taskType, taskTitle } = await request.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('timezone').eq('id', businessId).single()
  const today = dateInTimezone(business?.timezone)

  await appendDailyLogEntry(supabase, businessId, today, 'tasks_actioned', {
    taskId, taskType, taskTitle, action: 'skipped',
  })

  return NextResponse.json({ success: true })
}
