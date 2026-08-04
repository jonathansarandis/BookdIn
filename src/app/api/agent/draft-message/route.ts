// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function buildTaskBrief(taskType: string, ctx: any, businessName: string, businessPhone: string) {
  if (taskType === 'chase_payment') {
    return `Draft a payment reminder for ${ctx.customerName}. They owe ${formatCurrency(ctx.amount || 0)} for a job on ${ctx.jobDate || 'a recent booking'} with ${businessName}. Business phone: ${businessPhone || 'not provided'}. Tone: warm and direct, not pushy — assume it might just be an oversight. Give them an easy way to reach out (call/reply) rather than inventing a payment link, since there isn't one.`
  }
  if (taskType === 'follow_up_lead' && ctx.quoteTotal != null) {
    return `Draft a follow-up for ${ctx.customerName}, who was sent a quote for ${formatCurrency(ctx.quoteTotal)} on ${ctx.quoteSentAt || 'a few days ago'} from ${businessName} and hasn't responded. Business phone: ${businessPhone || 'not provided'}. Tone: helpful, low-pressure — invite questions or confirm if they'd like to go ahead.`
  }
  if (taskType === 'follow_up_lead') {
    return `Draft a follow-up for ${ctx.customerName}, a lead who enquired with ${businessName} ${ctx.daysSinceCreated != null ? `${ctx.daysSinceCreated} days ago` : 'recently'} and hasn't been contacted yet. Business phone: ${businessPhone || 'not provided'}. Tone: friendly introduction, reference their enquiry, invite them to book or ask questions.`
  }
  return `Draft a short, friendly outreach message for ${ctx.customerName} from ${businessName}.`
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  const businessId = profile?.business_id
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('name, phone').eq('id', businessId).single()
  const businessName = business?.name || 'the team'
  const businessPhone = business?.phone || ''

  const { taskType, context } = await request.json()
  if (!taskType || !context?.customerName) {
    return NextResponse.json({ error: 'Missing taskType or context.customerName' }, { status: 400 })
  }

  const taskBrief = buildTaskBrief(taskType, context, businessName, businessPhone)

  const systemPrompt = `You draft outreach messages on behalf of ${businessName}, a cleaning services business. A staff member (VA) will review and edit your draft before it's sent — nothing goes out without their approval — so your job is to get the tone, facts, and structure right as a strong starting point.

Respond with ONLY a raw JSON object — no markdown code fences, no commentary before or after — in exactly this shape:
{"sms": "...", "emailSubject": "...", "emailBody": "..."}

Rules:
- sms: under 320 characters, plain text, no markdown, signed off with "- ${businessName}"
- emailSubject: short and clear, no "Re:" unless replying to something specific
- emailBody: 2-4 short plain-text paragraphs (no HTML, no markdown), signed off with "${businessName}"
- Never invent specific details (URLs, dates, amounts) beyond what's given in the brief
- Never use em dashes (—) in the sms or emailBody text. Use a comma, a period, or restructure the sentence instead
- Natural and human — avoid corporate boilerplate like "We hope this message finds you well"`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: taskBrief }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : null
    }

    if (!parsed || typeof parsed.sms !== 'string' || typeof parsed.emailBody !== 'string') {
      return NextResponse.json({ error: 'Could not parse draft from AI response' }, { status: 500 })
    }

    return NextResponse.json({
      sms: parsed.sms,
      emailSubject: parsed.emailSubject || `A note from ${businessName}`,
      emailBody: parsed.emailBody,
    })
  } catch (err: any) {
    console.error('draft-message error:', err)
    return NextResponse.json({ error: err.message || 'Failed to draft message' }, { status: 500 })
  }
}
