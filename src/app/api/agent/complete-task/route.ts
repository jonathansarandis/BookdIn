// @ts-nocheck
// src/app/api/agent/complete-task/route.ts
// Logs a task as done from the /agent/workflow checklist. Distinct from
// dismiss-task (which logs action:'skipped' for the dashboard widget's X
// button) — this logs action:'completed' with an optional note, but both
// append to the same tasks_actioned field so eod-summary's dedup logic
// (tasks_actioned ∪ messages_sent by taskId) picks either up the same way.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { appendDailyLogEntry, dateInTimezone } from '@/lib/agent/dailyLog'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id, full_name').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { taskId, taskType, taskTitle, note } = await request.json()
  if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('timezone').eq('id', businessId).single()
  const today = dateInTimezone(business?.timezone)

  const log = await appendDailyLogEntry(supabase, businessId, today, 'tasks_actioned', {
    taskId, taskType, taskTitle, action: 'completed',
    note: note?.trim() || undefined,
    completedBy: profile.full_name || 'Team member',
  })

  return NextResponse.json({ success: true, log })
}
