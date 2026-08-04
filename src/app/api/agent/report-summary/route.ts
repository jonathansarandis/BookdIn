// @ts-nocheck
// src/app/api/agent/report-summary/route.ts
// "Report to Jonathan" on the /agent/workflow completion screen: saves the
// VA's free-text end-of-day summary onto today's agent_daily_logs row (same
// upsert shape the eod-summary cron already uses for `notes`) and notifies
// every owner on the business — the same notifications table/shape the
// public-booking route and capture-payments cron already write to.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { dateInTimezone } from '@/lib/agent/dailyLog'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id, full_name').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { summary } = await request.json()
  if (!summary?.trim()) return NextResponse.json({ error: 'Missing summary' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('name, timezone').eq('id', businessId).single()
  const today = dateInTimezone(business?.timezone)

  const { error: upsertError } = await supabase
    .from('agent_daily_logs')
    .upsert({ business_id: businessId, date: today, notes: summary.trim() }, { onConflict: 'business_id,date' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  const { data: owners } = await supabase
    .from('profiles').select('id').eq('business_id', businessId).eq('role', 'owner')

  if (owners?.length) {
    await supabase.from('notifications').insert(
      owners.map(o => ({
        business_id: businessId,
        user_id: o.id,
        type: 'team_daily_report',
        title: `📋 Daily report from ${profile.full_name || 'the team'}`,
        body: summary.trim(),
        action_url: '/dashboard',
      }))
    )
  }

  return NextResponse.json({ success: true })
}
