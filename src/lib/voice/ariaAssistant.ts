// Shared Aria prompt/tools/payload builders, used by both the live (cascaded
// Claude + 11labs + Deepgram) assistant path and the OpenAI Realtime test
// assistant path. Factored out of create-assistant/route.ts so both routes
// build the exact same system prompt and tool definitions and never drift
// out of sync with each other.
import { formatCents } from '@/lib/voice/shared'

export const SYSTEM_PROMPT_TEMPLATE = `You are {{agent_name}}, the booking assistant for {{business_name}}. You help customers book cleaning services quickly and professionally, over the phone.

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

PRICING — always confirm the real number with the tool, and always say GST out loud:
- Never quote a price from memory or from the services list above — always call get_pricing once you know the service and property details, and state the number it gives you back. That figure already has GST added on top, it's the final total the customer pays.
- Even though GST is already included in that number, always say so explicitly when you state it — e.g. "that comes to $196.90, including GST" or "so all up, with GST, that's $196.90." Never just say the bare dollar figure with no mention of GST at all — the caller should always hear that GST is accounted for, not have to ask.

EMAIL ADDRESSES — never guess the spelling:
- When you ask for their email, always ask them to spell it out, especially the part before the @ — e.g. "Could you spell that for me, just to make sure I've got it exactly right?"
- Once they've spelled it, always read the full email address back to them and get a clear yes before moving on. Never assume you heard it correctly from natural speech alone — spelling mistakes here mean the customer never gets their confirmation.

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

export function buildToolDefinitions(serverUrl: string) {
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

export function buildSystemPrompt(business: any, services: any[], locations: any[]) {
  const agentName = business.voice_agent_name || 'Aria'

  const businessDetails = [
    business.name,
    locations.length ? `Serving: ${locations.map((l: any) => l.name).join(', ')}` : null,
    business.phone ? `Phone: ${business.phone}` : null,
  ].filter(Boolean).join('. ')

  // These are raw ex-GST base prices for context only — NOT what should be quoted to a
  // caller. The "(ex GST)" label is a guardrail in case the model ever references this
  // list directly instead of calling get_pricing, which returns the real GST-inclusive total.
  const servicesPricing = services.length
    ? services.map((s: any) => `${s.name} — from ${formatCents(s.base_price, business.currency || 'AUD')} (ex GST — do not quote this directly, call get_pricing)`).join('; ')
    : 'No services configured yet.'

  const businessHours = business.voice_business_hours || 'Monday to Saturday, 8am–6pm'

  return SYSTEM_PROMPT_TEMPLATE
    .replaceAll('{{agent_name}}', agentName)
    .replaceAll('{{business_name}}', business.name)
    .replaceAll('{{business_details}}', businessDetails)
    .replaceAll('{{services_pricing}}', servicesPricing)
    .replaceAll('{{business_hours}}', businessHours)
    .replaceAll('{{custom_personality}}', business.voice_agent_personality || '')
    .replaceAll('{{knowledge_base}}', business.voice_agent_knowledge
      ? `REFERENCE KNOWLEDGE — packages, add-ons, and policies:\nThis is background knowledge, not a script. Never recite it unprompted — draw on it only when a caller asks something specific it answers.\n\n${business.voice_agent_knowledge}`
      : '')
}

// The live, production assistant: cascaded pipeline (Claude -> Deepgram STT ->
// 11labs TTS). See create-assistant/route.ts header comment for the history
// behind each of the turn-taking / audio-quality fields below.
export function buildVapiAssistantPayload(business: any, services: any[], locations: any[], appUrl: string) {
  const agentName = business.voice_agent_name || 'Aria'
  const systemPrompt = buildSystemPrompt(business, services, locations)
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
    transcriber: {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'en',
    },
    backgroundSpeechDenoisingPlan: {
      smartDenoisingPlan: { enabled: true },
    },
    serverUrl: `${appUrl}/api/voice/vapi/call-events`,
    backchannelingEnabled: false,
    responseDelaySeconds: 0.4,
    startSpeakingPlan: {
      waitSeconds: 0.4,
      smartEndpointingPlan: {
        provider: 'livekit',
        waitFunction: '2000 / (1 + exp(-10 * (x - 0.5)))',
      },
    },
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1.0,
    },
  }
}

// Test-only assistant: OpenAI's native speech-to-speech Realtime model,
// architecturally the same category of model behind ChatGPT's voice mode.
// Cross-checked against Vapi's live "OpenAI Realtime" docs (Aug 2026):
//   - model.provider/model.model as below; system prompt is auto-converted
//     to session instructions by Vapi, same `messages` shape as the cascaded
//     path, tools work unchanged.
//   - voice.provider must be 'openai', voiceId one of alloy/echo/shimmer
//     (standard) or marin/cedar (realtime-exclusive) — NOT the 11labs voice.
//   - No transcriber block: realtime models process audio natively and Vapi's
//     docs say transcriber config isn't used/needed here.
//   - Docs note endpointing/interruption are managed by Vapi's own
//     orchestration layer for realtime models, so startSpeakingPlan/
//     stopSpeakingPlan are intentionally left out here rather than guessed at.
//   - Knowledge Bases (Vapi's RAG feature) aren't supported on realtime models,
//     but Aria doesn't use that feature anyway — her knowledge is plain system
//     prompt text, so this has no effect here.
export function buildVapiRealtimePayload(business: any, services: any[], locations: any[], appUrl: string, voiceId: string = 'marin') {
  const agentName = business.voice_agent_name || 'Aria'
  const systemPrompt = buildSystemPrompt(business, services, locations)
  const serverUrl = `${appUrl}/api/voice/vapi`

  return {
    name: `${business.name} — ${agentName} (Realtime test)`,
    firstMessage: `Hi there, thanks for calling ${business.name}! You're speaking with ${agentName} — looks like you've either caught us outside office hours or the team's on other calls, but I can help: I can answer questions, get you booked in, or take a message for a callback. What can I do for you?`,
    model: {
      provider: 'openai',
      model: 'gpt-realtime-2025-08-28',
      messages: [{ role: 'system', content: systemPrompt }],
      tools: buildToolDefinitions(serverUrl),
      temperature: 0.7,
      maxTokens: 300,
    },
    voice: {
      provider: 'openai',
      voiceId,
    },
    serverUrl: `${appUrl}/api/voice/vapi/call-events`,
  }
}
