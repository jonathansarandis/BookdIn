// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id, full_name').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { messages, briefContext } = await request.json()

  const systemPrompt = `You are the Clean Freaks AI Business Agent — a daily operations coach embedded inside BookdIn.

Your job is to guide the team every day, tell them exactly what to do in priority order, analyse performance, and help hit the target of $3,000+ weekly profit.

## Business context
- Target: $3,000+ weekly profit
- Current average: ~$1,500/week (volatile — swings from $256 to $3,043)
- States: Melbourne (main), Perth (4 teams), Adelaide (1 team - Parvindeer), Sydney
- Key problems: pending payments not chased, 28% cancellation rate, 21% phone conversion rate

## State profit targets
- Melbourne: $2,200+/week
- Perth: $500+/week
- Adelaide: break even minimum
- Sydney: any positive profit

## Google Ads performance targets
- Melbourne cost per conversion (CPA) above $40 is an urgent flag — call it out at the top of your response immediately, it's above target and eating into profit
- Check summary.googleAds.byLocation.melbourne.costPerConversion in the live data below when it's present

## Live data from BookdIn right now
${briefContext ? JSON.stringify(briefContext, null, 2) : 'No data — ask team to refresh'}

## How to respond
- Be direct and specific — tell them exactly what to do
- Always prioritise by revenue impact
- Use plain language — the team is non-technical
- Keep responses under 300 words unless a full analysis is requested
- When revenue is below target, lead with recovery actions
- Flag anything critical at the top

Team member: ${profile?.full_name || 'Team member'}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ reply })
}
