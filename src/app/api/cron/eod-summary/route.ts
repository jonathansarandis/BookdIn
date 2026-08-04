// @ts-nocheck
// src/app/api/cron/eod-summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAgentBrief } from '@/lib/agent/buildBrief'
import { getDailyLog, dateInTimezone } from '@/lib/agent/dailyLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHASE_PAYMENT_CONVERSION_RATE = 0.4

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(0)}`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: businesses } = await supabase.from('businesses').select('id, name, timezone')

  let summarised = 0
  const errors: { businessId: string; error: string }[] = []

  for (const business of businesses || []) {
    try {
      const { data: owners } = await supabase
        .from('profiles').select('id').eq('business_id', business.id).eq('role', 'owner')
      if (!owners?.length) continue

      const today = dateInTimezone(business.timezone)
      const [brief, todayLog] = await Promise.all([
        buildAgentBrief(supabase, business.id),
        getDailyLog(supabase, business.id, today),
      ])

      const tasksActioned = todayLog?.tasks_actioned || []
      const messagesSent = todayLog?.messages_sent || []
      const outcomes = todayLog?.outcomes || []
      const totalSurfaced = brief.tasks.length

      // A task is "actioned" if it was either messaged (via the approval modal) or explicitly
      // dismissed — dedupe by taskId in case a task appears in both over the course of the day.
      const actionedTaskIds = new Set([
        ...tasksActioned.map((t: any) => t.taskId).filter(Boolean),
        ...messagesSent.map((m: any) => m.taskId).filter(Boolean),
      ])

      const chasedPaymentCents = messagesSent
        .filter((m: any) => m.taskType === 'chase_payment' && typeof m.amount === 'number')
        .reduce((sum: number, m: any) => sum + m.amount, 0)
      const revenueRecoveredCents = Math.round(chasedPaymentCents * CHASE_PAYMENT_CONVERSION_RATE)
      // Stored in dollars (unlike task amounts elsewhere, which are cents) — this is a
      // reporting-only field meant to be read directly, not fed back into money math.
      const revenueRecoveredDollars = revenueRecoveredCents / 100

      const notesParts = [
        `${actionedTaskIds.size}/${totalSurfaced} tasks actioned today.`,
        `${messagesSent.length} message${messagesSent.length === 1 ? '' : 's'} sent.`,
        `~${formatCurrency(revenueRecoveredCents)} revenue recovered from chased payments (${Math.round(CHASE_PAYMENT_CONVERSION_RATE * 100)}% conversion estimate).`,
      ]
      if (outcomes.length) {
        notesParts.push(`Team notes: ${outcomes.map((o: any) => o.note).join(' | ')}`)
      }
      const notes = notesParts.join(' ')

      await supabase.from('agent_daily_logs').upsert(
        { business_id: business.id, date: today, revenue_recovered: revenueRecoveredDollars, notes },
        { onConflict: 'business_id,date' }
      )

      await supabase.from('notifications').insert(
        owners.map(o => ({
          business_id: business.id,
          user_id: o.id,
          type: 'eod_summary',
          title: `📊 End of day — ${business.name}`,
          body: notes,
          action_url: '/dashboard',
        }))
      )

      summarised++
    } catch (err: any) {
      errors.push({ businessId: business.id, error: err.message })
    }
  }

  return NextResponse.json({
    message: 'EOD summary cron completed',
    businesses_checked: businesses?.length || 0,
    summarised,
    errors,
  })
}
