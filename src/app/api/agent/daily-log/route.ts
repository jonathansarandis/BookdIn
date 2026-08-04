// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getDailyLog, dateInTimezone } from '@/lib/agent/dailyLog'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('timezone').eq('id', businessId).single()

  const { searchParams } = new URL(request.url)
  const offset = searchParams.get('offset') // e.g. "-1" for yesterday
  const date = searchParams.get('date') || dateInTimezone(business?.timezone, offset ? parseInt(offset, 10) : 0)

  const log = await getDailyLog(supabase, businessId, date)
  return NextResponse.json({ date, log: log || null })
}
