// @ts-nocheck
// src/app/api/cron/morning-briefing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { buildAgentBrief } from '@/lib/agent/buildBrief'
import { getDailyLog, dateInTimezone } from '@/lib/agent/dailyLog'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatCurrency(cents: number) {
  return `$${((cents || 0) / 100).toFixed(0)}`
}

async function draftBriefing(businessName: string, yesterday: any, brief: any): Promise<string> {
  const yesterdaySummary = yesterday
    ? `Yesterday: ${(yesterday.tasks_actioned || []).length} tasks actioned, ${(yesterday.messages_sent || []).length} messages sent, ${formatCurrency(yesterday.revenue_recovered * 100)} revenue recovered.` +
      ((yesterday.outcomes || []).length ? ` Team notes: ${(yesterday.outcomes || []).map((o: any) => o.note).join(' | ')}.` : '')
    : 'No log from yesterday (first day, or nothing was actioned).'

  const todaySummary = `Today: ${brief.summary.pendingPaymentCount} pending payments (${formatCurrency(brief.summary.pendingPaymentValue)} at risk), ${brief.summary.todayJobCount} jobs scheduled, ${brief.summary.unassignedCount} unassigned, ${brief.summary.crmStaleLeadCount} stale leads. This week revenue ${formatCurrency(brief.summary.thisWeekRevenue)} (${brief.summary.revenueChange >= 0 ? '+' : ''}${brief.summary.revenueChange}% vs last week).`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: `You write a short morning briefing (3-5 sentences, plain text, no markdown, no em dashes) for the ${businessName} team inside BookdIn. Reference what happened yesterday if there's anything notable, then call out today's top priority in specific numbers. Direct and conversational, like a colleague who already checked the numbers — not corporate. Do not use em dashes; use commas or separate sentences instead.`,
    messages: [{ role: 'user', content: `${yesterdaySummary}\n\n${todaySummary}` }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : todaySummary
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: businesses } = await supabase.from('businesses').select('id, name, timezone')

  let briefed = 0
  const errors: { businessId: string; error: string }[] = []

  for (const business of businesses || []) {
    try {
      const { data: staff } = await supabase
        .from('profiles').select('id').eq('business_id', business.id)
      if (!staff?.length) continue

      const today = dateInTimezone(business.timezone)
      const yesterday = dateInTimezone(business.timezone, -1)

      const [brief, yesterdayLog] = await Promise.all([
        buildAgentBrief(supabase, business.id),
        getDailyLog(supabase, business.id, yesterday),
      ])

      const briefingText = await draftBriefing(business.name || 'your business', yesterdayLog, brief)

      await supabase.from('notifications').insert(
        staff.map(s => ({
          business_id: business.id,
          user_id: s.id,
          type: 'morning_briefing',
          title: `☀️ Morning briefing — ${business.name}`,
          body: briefingText,
          action_url: '/agent',
        }))
      )

      briefed++
    } catch (err: any) {
      errors.push({ businessId: business.id, error: err.message })
    }
  }

  return NextResponse.json({
    message: 'Morning briefing cron completed',
    businesses_checked: businesses?.length || 0,
    briefed,
    errors,
  })
}
