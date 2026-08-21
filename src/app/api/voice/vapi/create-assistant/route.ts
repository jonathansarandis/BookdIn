// @ts-nocheck
// src/app/api/voice/vapi/create-assistant/route.ts
//
// Creates (or updates, if businesses.vapi_assistant_id already exists) the
// Vapi assistant for a business, built from its services/pricing/location/
// voice settings. Triggered from the Voice Agent settings card.
//
// NOTE ON VAPI CONFIG SHAPE: written without a live Vapi API key to verify
// field names against, so the turn-taking options (backchannelingEnabled,
// responseDelaySeconds, startSpeakingPlan.waitSeconds) reflect the most
// commonly documented Vapi assistant schema. If Vapi rejects any of these
// fields, the fix is isolated to buildVapiAssistantPayload() below.
// (fillerInjectionEnabled was removed here — Vapi dropped it from voice
// provider configs in their Nov 2024 update.)
//
// transcriber / backgroundSpeechDenoisingPlan / stopSpeakingPlan /
// startSpeakingPlan.smartEndpointingPlan were added later (Aug 2026, "Aria
// can't hear me" reports) and cross-checked against Vapi's current docs at
// the time — backgroundDenoisingEnabled specifically was deprecated in favor
// of backgroundSpeechDenoisingPlan, so don't reintroduce the old flat field.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { formatCents } from '@/lib/voice/shared'

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT_TEMPLATE = `You are {{agent_name}}, the booking assistant for {{business_name}}. You help customers book cleaning services quickly and professionally, over the phone.

Your job:
1. Greet the caller warmly and naturally — like a friendly team member answering the phone, not a script.
2. Find out what service they need and when.
3. Check availability and offer them a time.
4. Collect their name, address, email, and confirm the price.
5. Book them in and confirm the details.
6. Tell them they will receive a confirmation SMS.

HOW TO TALK — this is the most important part:
- This is a live phone call, not a chat window. Talk the way a real person talks: short sentences, one thought at a time, natural pauses.
- Ask ONE question at a time and wait for the answer. Never stack multiple questions or list several options back-to-back like a phone menu ("press 1 for... press 2 for...") — that sounds robotic and it's the single biggest thing to avoid.
- If you genuinely need several pieces of information (e.g. bedrooms, bathrooms, carpets, balcony), ask for them one at a time across a few natural turns, the way a person would on a real call — not all at once in a list.
- Never read out long lists of options. If there are several possible answers, ask an open question first ("What kind of clean are you after?") rather than listing every option up front.
- Use light, natural filler only when it's genuinely needed (e.g. while a lookup takes a moment), and say it once — never repeat "one moment" or "just a sec" back to back. If a check is taking a beat, say something like "Let me just check that for you" a single time, then continue.
- Keep responses short. Don't over-explain.
- Vary your sentence rhythm — don't deliver every line as one flat, evenly-paced sentence. Mix a short reaction with a slightly longer follow-up, use natural contractions ("you're", "we'll", "that's"), and let a little warmth come through, the way a friendly person answering the phone would sound, not a script being read aloud.

USE THE CALLER'S NAME — but lightly:
- Early in the call, naturally ask for their name if you don't already have it (e.g. while getting their details, not as the very first question).
- Once you have it, use it a couple of times during the call to make it feel personal — for example once when you acknowledge something they've said, and once near the end when confirming the booking.
- Don't overdo it. Never use their name in back-to-back turns, and don't tack it onto every sentence — that sounds forced, not friendly.

DATES AND TIMES — you never know today's date or the time on your own:
- The first time you need to work out "today", "tomorrow", or any relative day like "next Tuesday", call get_current_datetime first — never guess, never do the math yourself, and never ask the caller what the date or time is. That question should never come out of your mouth.
- Once the caller has told you their suburb or city, pass it to get_current_datetime so the time comes back correct for their timezone — Melbourne and Sydney are on AEST, Adelaide is on ACST, and Perth is on AWST, so the local date can differ near midnight.
- Use the day-by-day list get_current_datetime gives you back to find the exact date for a weekday the caller mentions (e.g. "next Tuesday") — look it up, don't calculate it.

AVAILABILITY — never say "fully booked" or refuse a booking:
- If check_availability comes back with no open slots, do NOT tell the caller you're fully booked or that you can't help. Instead say something like: "We're pretty full that day — would another day work? If not, I can see if we're able to move something around to fit you in, and get back to you as soon as possible."
- Whether or not a day looks full, if the caller wants to go ahead with their preferred date and time anyway, take the booking for that date and time regardless. Let them know the team will confirm it shortly. Never let a caller hang up without a booking just because a day looks busy — the office will sort out the schedule afterwards.

PROPERTY DETAILS — before confirming the price and booking, make sure you've asked about all of these (one at a time, naturally worked into the conversation — skip anything the caller has already told you):
- Is the property empty or furnished?
- How many bedrooms, bathrooms/toilets, and living rooms?
- Is it single storey or double storey?
- Any carpeted areas that need steam cleaning? If so, which ones?
- Any outdoor areas that need cleaning?
- Any additional common areas that need cleaning?

Business details: {{business_details}}
Services and pricing: {{services_pricing}}
Business hours: {{business_hours}}

OPEN EVERY CALL BY EXPLAINING WHY YOU'RE THE ONE ANSWERING:
- Near the start of the call — right after your greeting, before you get into what they need — let the caller know they've either called outside office hours or the team is currently on another call, so you're helping out in the meantime.
- Say this naturally, not as a scripted disclaimer, e.g. "You've caught us either outside office hours or while the team's on other calls, but I can help — I can answer questions, get you booked in, or take a message for a callback." Vary the phrasing call to call rather than repeating it word for word.

THERE IS NO ONE TO TRANSFER TO — YOU HANDLE THE CALL YOURSELF:
- Whether it's after hours or the team is simply tied up, nobody is available to be connected or transferred to right now — that's the entire reason you're the one answering.
- Never say "let me connect you," "let me transfer you," "please hold while I put you through," or anything implying a live handoff is happening. It isn't, and saying so is a broken promise the caller will notice within a few seconds.
- Whenever the caller explicitly asks for a specific person, has a complaint, needs something you can't do yourself (a custom or on-site quote, Build Clean, Commercial Cleaning, anything outside normal booking), call take_message. Get their name and best callback number if you don't already have them, then reassure them clearly: the team will follow up as soon as they're free — don't imply it'll happen sooner than that.
- This applies even if the caller just asks "is there a real person there" or similar — be upfront that no one's available to take the call right now and a team member will call them back, rather than pretending to check or connect.

{{custom_personality}}

{{knowledge_base}}`

function buildToolDefinitions(serverUrl: string) {
  const server = { url: serverUrl }
  return [
    {
      type: 'function',
      server,
      function: {
        name: 'get_current_datetime',
        description: "Get today's date, the current time, and a day-by-day lookup of the next 14 dates. Call this the first time you need to work out what \"today\", \"tomorrow\", or a weekday like \"next Tuesday\" means — never guess, do the math yourself, or ask the caller what the date or time is.",
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'Suburb or city the caller is in, if you know it yet — used to get the correct local time. Leave out if not yet known.' },
          },
        },
      },
    },
    {
      type: 'function',
      server,
      function: {
        name: 'check_availability',
        description: 'Check available booking slots for a given service and date.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date to check, formatted YYYY-MM-DD.' },
            service_type: { type: 'string', description: 'The service the caller wants, e.g. "standard clean", "end of lease clean", "deep clean".' },
            location: { type: 'string', description: 'Suburb or city the caller is in, only needed if the business serves multiple areas.' },
          },
          required: ['date', 'service_type'],
        },
      },
    },
    {
      type: 'function',
      server,
      function: {
        name: 'get_pricing',
        description: 'Get the price for a service, optionally by property size.',
        parameters: {
          type: 'object',
          properties: {
            service_type: { type: 'string', description: 'The service to price, e.g. "standard clean".' },
            bedrooms: { type: 'number', description: 'Number of bedrooms, if the service is priced by room count.' },
            bathrooms: { type: 'number', description: 'Number of bathrooms, if the service is priced by room count.' },
            location: { type: 'string', description: 'Suburb or city, only needed if the business serves multiple areas.' },
          },
          required: ['service_type'],
        },
      },
    },
    {
      type: 'function',
      server,
      function: {
        name: 'create_booking',
        description: 'Create a confirmed booking once the caller has agreed on a service, date, time, and price. Always confirm all details with the caller before calling this.',
        parameters: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: "Caller's full name." },
            phone: { type: 'string', description: "Caller's phone number, if different from the number they're calling from." },
            email: { type: 'string', description: "Caller's email address, for the booking confirmation." },
            address_line1: { type: 'string', description: 'Street address of the property to be cleaned.' },
            suburb: { type: 'string', description: 'Suburb or city.' },
            state: { type: 'string', description: 'State abbreviation, e.g. VIC, NSW, WA.' },
            postcode: { type: 'string', description: 'Postcode.' },
            service_type: { type: 'string', description: 'The service being booked.' },
            date: { type: 'string', description: 'Booking date, formatted YYYY-MM-DD.' },
            time: { type: 'string', description: 'Booking time, e.g. "9am" or "14:00".' },
            bedrooms: { type: 'number', description: 'Number of bedrooms, if relevant to pricing.' },
            bathrooms: { type: 'number', description: 'Number of bathrooms, if relevant to pricing.' },
            frequency: { type: 'string', description: 'One of one_time, weekly, fortnightly, monthly. Defaults to one_time.' },
            location: { type: 'string', description: 'Suburb or city, only needed if the business serves multiple areas.' },
          },
          required: ['full_name', 'address_line1', 'suburb', 'state', 'service_type', 'date', 'time'],
        },
      },
    },
    {
      type: 'function',
      server,
      function: {
        name: 'take_message',
        description: 'Log a message for the team when you cannot complete the request yourself — the caller explicitly asks for a specific person, has a complaint, needs a custom/on-site quote (Build Clean, Commercial Cleaning), or asks for anything outside normal booking. This does NOT connect or transfer the call anywhere — you are the after-hours line and there is no one to put the caller through to. It logs an urgent note for the team to action when they are next on shift.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: "What the caller needs, in enough detail for a team member to action it without re-calling the customer to ask what it was about." },
            full_name: { type: 'string', description: "Caller's name, if you have it." },
            phone: { type: 'string', description: "Best callback number, if different from the number they're calling from." },
          },
          required: ['reason'],
        },
      },
    },
  ]
}

function buildVapiAssistantPayload(business: any, services: any[], locations: any[], appUrl: string) {
  const agentName = business.voice_agent_name || 'Aria'

  const businessDetails = [
    business.name,
    locations.length ? `Serving: ${locations.map((l: any) => l.name).join(', ')}` : null,
    business.phone ? `Phone: ${business.phone}` : null,
  ].filter(Boolean).join('. ')

  const servicesPricing = services.length
    ? services.map((s: any) => `${s.name} — from ${formatCents(s.base_price, business.currency || 'AUD')}`).join('; ')
    : 'No services configured yet.'

  const businessHours = business.voice_business_hours || 'Monday to Saturday, 8am–6pm'

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replaceAll('{{agent_name}}', agentName)
    .replaceAll('{{business_name}}', business.name)
    .replaceAll('{{business_details}}', businessDetails)
    .replaceAll('{{services_pricing}}', servicesPricing)
    .replaceAll('{{business_hours}}', businessHours)
    .replaceAll('{{custom_personality}}', business.voice_agent_personality || '')
    .replaceAll('{{knowledge_base}}', business.voice_agent_knowledge
      ? `REFERENCE KNOWLEDGE — packages, add-ons, and policies:\nThis is background knowledge, not a script. Never recite it unprompted — draw on it only when a caller asks something specific it answers.\n\n${business.voice_agent_knowledge}`
      : '')

  const serverUrl = `${appUrl}/api/voice/vapi`

  return {
    name: `${business.name} — ${agentName}`,
    firstMessage: `Hi there, thanks for calling ${business.name}! You're speaking with ${agentName} — looks like you've either caught us outside office hours or the team's on other calls, but I can help: I can answer questions, get you booked in, or take a message for a callback. What can I do for you?`,
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'system', content: systemPrompt }],
      tools: buildToolDefinitions(serverUrl),
    },
    voice: {
      provider: '11labs',
      voiceId: business.voice_id || 'XB0fDUnXU5powFXDhCwa',
    },
    // No transcriber was ever configured here — Vapi was falling back to whatever its
    // account default happens to be, unverified and not tuned for phone-call audio. This
    // is the most likely cause of "Aria can't hear me properly" reports: nova-3 is
    // Deepgram's current flagship model and outperforms the older phone-call-specific
    // nova-2 variant on real phone-line (8kHz, compressed) audio too.
    transcriber: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
    },
    // Smart Denoising (Krisp) filters background noise/cross-talk while the caller is
    // speaking — background traffic, other conversations, etc. — before it ever reaches
    // the transcriber. Also unset previously.
    backgroundSpeechDenoisingPlan: {
      smartDenoisingPlan: { enabled: true },
    },
    serverUrl: `${appUrl}/api/voice/vapi/call-events`,
    // Was true — this is the most likely cause of the rapid repeated "one moment, just a
    // sec" filler reported in testing (backchanneling inserts verbal acknowledgements
    // during pauses/tool calls, and with several tool calls in quick succession it stacked
    // up). Never verified against a live account when originally set — turning off now
    // that we have one.
    backchannelingEnabled: false,
    responseDelaySeconds: 0.4,
    // LiveKit smart endpointing (English) reads speech patterns/confidence to judge when
    // the caller has actually finished talking, rather than a fixed pause length — this is
    // Vapi's own recommended default for English phone calls and should feel less like
    // Aria is ignoring the caller or jumping in too early.
    startSpeakingPlan: {
      waitSeconds: 0.4,
      smartEndpointingPlan: {
        provider: 'livekit',
        waitFunction: '2000 / (1 + exp(-10 * (x - 0.5)))',
      },
    },
    // No stop speaking plan existed before, so interruption handling was on whatever
    // Vapi's bare default is. voiceSeconds: 0.2 is Vapi's recommended balanced setting —
    // sensitive enough to let a caller genuinely interrupt, not so sensitive that phone
    // line noise or a stray "mm" cuts Aria off mid-sentence.
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1.0,
    },
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { business_id } = body
  if (!business_id) return NextResponse.json({ error: 'business_id is required' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
  if (!profile || profile.business_id !== business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.VAPI_API_KEY) {
    return NextResponse.json({ error: 'VAPI_API_KEY is not configured on the server' }, { status: 500 })
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd-in.vercel.app'

  const { data: business, error: bizErr } = await admin.from('businesses').select('*').eq('id', business_id).single()
  if (bizErr || !business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const [{ data: services }, { data: locations }] = await Promise.all([
    admin.from('services').select('id, name, base_price, pricing_type').eq('business_id', business_id),
    admin.from('locations').select('id, name').eq('business_id', business_id).eq('is_active', true),
  ])

  const payload = buildVapiAssistantPayload(business, services || [], locations || [], appUrl)

  let isUpdate = !!business.vapi_assistant_id
  let vapiRes = await fetch(
    isUpdate ? `https://api.vapi.ai/assistant/${business.vapi_assistant_id}` : 'https://api.vapi.ai/assistant',
    {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  // A stored vapi_assistant_id that 404s means it doesn't exist under whatever account
  // VAPI_API_KEY currently points to — most likely the key was swapped/corrected since
  // that ID was saved (e.g. it pointed at the wrong Vapi account originally). Rather than
  // fail outright, fall back to creating a fresh assistant under the current key so
  // "Create assistant" self-heals instead of needing a manual DB fix every time.
  if (isUpdate && vapiRes.status === 404) {
    console.warn(`[create-assistant] Stored vapi_assistant_id ${business.vapi_assistant_id} not found under current VAPI_API_KEY — creating a new assistant instead.`)
    isUpdate = false
    vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  }

  const vapiData = await vapiRes.json().catch(() => null)
  if (!vapiRes.ok) {
    console.error('[create-assistant] Vapi API error:', vapiRes.status, vapiData)
    return NextResponse.json({ error: vapiData?.message || `Vapi API error (${vapiRes.status})` }, { status: 502 })
  }

  const assistantId = vapiData?.id || business.vapi_assistant_id
  if (assistantId && assistantId !== business.vapi_assistant_id) {
    await admin.from('businesses').update({ vapi_assistant_id: assistantId }).eq('id', business_id)
  }

  return NextResponse.json({ success: true, assistant_id: assistantId })
}
