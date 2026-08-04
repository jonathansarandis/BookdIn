// @ts-nocheck
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

  const { note } = await request.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Missing note' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('timezone').eq('id', businessId).single()
  const today = dateInTimezone(business?.timezone)

  const log = await appendDailyLogEntry(supabase, businessId, today, 'outcomes', {
    note: note.trim(),
    loggedBy: profile.full_name || 'Team member',
  })

  return NextResponse.json({ success: true, log })
}
