// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isGoogleAdsConfigured, getGoogleAdsHistory } from '@/lib/googleAds'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Lets the agent look back further than the single trailing-week snapshot baked into
// briefContext — e.g. "why did Adelaide's CPA spike" needs several weeks of trend, not
// just today's number. Only offered when Google Ads is actually configured, so the
// model never tries to call it and hits a config error instead of a real answer.
const GOOGLE_ADS_HISTORY_TOOL = {
  name: 'get_google_ads_history',
  description: "Get Google Ads spend, conversions, and cost-per-conversion (CPA) broken down by week and by location (Melbourne, Perth, Adelaide, Sydney), going back further than the single week already provided in the live data above. Use this whenever the team asks about trends, spikes, drops, or 'why' something in ad performance changed — one call can cover several weeks at once.",
  input_schema: {
    type: 'object',
    properties: {
      weeks: { type: 'number', description: 'How many trailing complete weeks of history to fetch, ending yesterday. Default 8, max 16. Use more weeks (e.g. 12-16) when asked to find when a trend started.' },
    },
  },
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id, full_name').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses')
    .select('name, google_ads_customer_id, google_ads_enabled, google_ads_developer_token_encrypted, google_ads_developer_token_iv, google_ads_refresh_token_encrypted, google_ads_refresh_token_iv, google_ads_login_customer_id')
    .eq('id', businessId)
    .single()
  const businessName = business?.name || 'this business'
  const adsConfigured = business ? isGoogleAdsConfigured(business as any) : false

  const { messages, briefContext } = await request.json()

  const systemPrompt = `You are the ${businessName} AI Business Agent — a daily operations coach embedded inside BookdIn.

Your job is to guide the team every day, tell them exactly what to do in priority order, and analyse performance based on the live data below.

## Google Ads performance
- A location's cost per conversion (CPA) above $40 is an urgent flag — call it out at the top of your response immediately if you see one, it's above target and eating into profit
- Check summary.googleAds.byLocation in the live data below when it's present — that's already a trailing 7-day snapshot, not a single day
- ${adsConfigured ? "If asked about trends, spikes, or 'why' a number changed, call get_google_ads_history to see multiple weeks — don't guess or tell the team to go check Google Ads themselves when you can just pull the data yourself." : 'get_google_ads_history is not available — Google Ads is not connected for this business.'}

## Live data from BookdIn right now
${briefContext ? JSON.stringify(briefContext, null, 2) : 'No data — ask team to refresh'}

## How to respond
- Be direct and specific — tell them exactly what to do
- Always prioritise by revenue impact
- Use plain language — the team is non-technical
- Keep responses under 300 words unless a full analysis is requested
- When revenue or profit looks weak this week, lead with recovery actions
- Flag anything critical at the top

Team member: ${profile?.full_name || 'Team member'}`

  const anthropicMessages: any[] = messages.map((m: any) => ({ role: m.role, content: m.content }))
  const tools = adsConfigured ? [GOOGLE_ADS_HISTORY_TOOL] : undefined

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: systemPrompt,
    messages: anthropicMessages,
    tools,
  })

  // Tool-use loop: the model can call get_google_ads_history, we execute it and feed the
  // result back, and it keeps going until it produces a final text answer. Capped at a
  // few rounds so a misbehaving/looping model can't hang the request indefinitely.
  let rounds = 0
  while (response.stop_reason === 'tool_use' && rounds < 3) {
    rounds++
    anthropicMessages.push({ role: 'assistant', content: response.content })

    const toolResults = await Promise.all(
      response.content
        .filter((block: any) => block.type === 'tool_use')
        .map(async (block: any) => {
          let result: string
          try {
            if (block.name === 'get_google_ads_history') {
              const weeks = Math.min(Math.max(Number(block.input?.weeks) || 8, 1), 16)
              const history = await getGoogleAdsHistory(business as any, weeks)
              result = JSON.stringify(history)
            } else {
              result = `Unknown tool: ${block.name}`
            }
          } catch (e: any) {
            result = `Tool failed: ${e.message || 'unknown error'}`
          }
          return { type: 'tool_result', tool_use_id: block.id, content: result }
        })
    )
    anthropicMessages.push({ role: 'user', content: toolResults })

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: anthropicMessages,
      tools,
    })
  }

  const textBlock = response.content.find((block: any) => block.type === 'text')
  const reply = textBlock ? textBlock.text : ''
  return NextResponse.json({ reply })
}
