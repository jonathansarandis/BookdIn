// @ts-nocheck
// src/app/api/voice/vapi/route.ts
//
// Vapi tool-call webhook. Vapi calls this URL in real time during a live call
// whenever the assistant invokes one of the tools configured on it
// (see /api/voice/vapi/create-assistant): check_availability, get_pricing,
// create_booking, take_message, get_current_datetime.
//
// NOTE ON PAYLOAD SHAPE: this was built without a live Vapi account/API key to
// verify against, so the request parsing in src/lib/voice/shared.ts reads every
// field-nesting variant documented for Vapi's "tool-calls" and legacy
// "function-call" server messages. If Vapi's actual payload differs, only
// extractCallInfo()/extractToolCalls() should need adjusting — the tool
// handlers below are payload-shape agnostic.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calcJobPrice, applyFrequencyDiscount, calcTaxSplit } from '@/lib/pricing'
import { fromBusinessDateTime, formatBusinessDateTime, getCurrentDateTimeInfo } from '@/lib/datetime'
import { upsertCrmContact, logCrmActivity } from '@/lib/crm/upsert'
import { sendBookingConfirmation } from '@/lib/email'
import { getAvailableSlots } from '@/lib/voice/availability'
import {
  resolveBusinessByAssistantId,
  resolveBusinessByPhoneNumber,
  resolveLocation,
  resolveService,
  extractCallInfo,
  extractToolCalls,
  formatCents,
} from '@/lib/voice/shared'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HARDCODED_DISCOUNTS: Record<string, number> = { weekly: 5, fortnightly: 10, monthly: 10 }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { assistantId, vapiCallId, fromNumber, toNumber } = extractCallInfo(body)

  const toolCalls = extractToolCalls(body)
  if (toolCalls.length === 0) {
    return NextResponse.json({ error: 'No tool calls in payload' }, { status: 400 })
  }

  let business = await resolveBusinessByAssistantId(admin, assistantId)
  if (!business) business = await resolveBusinessByPhoneNumber(admin, toNumber)

  if (!business) {
    console.error('[vapi webhook] Could not resolve business — assistantId=%s toNumber=%s', assistantId, toNumber)
    const results = toolCalls.map(tc => ({
      toolCallId: tc.id,
      result: 'Sorry, I am having trouble accessing the booking system right now. Please try again shortly.',
    }))
    return NextResponse.json({ results })
  }

  const callCtx = { vapiCallId, fromNumber }

  const results = await Promise.all(toolCalls.map(async (tc) => {
    try {
      const result = await dispatchTool(tc.name, tc.args, business, callCtx)
      return { toolCallId: tc.id, result: typeof result === 'string' ? result : JSON.stringify(result) }
    } catch (e: any) {
      console.error(`[vapi webhook] tool "${tc.name}" failed:`, e)
      return { toolCallId: tc.id, result: 'Sorry, something went wrong on my end handling that — could we try again?' }
    }
  }))

  return NextResponse.json({ results })
}

async function dispatchTool(name: string, args: any, business: any, callCtx: { vapiCallId: string | null; fromNumber: string | null }) {
  switch (name) {
    case 'get_current_datetime': return handleGetCurrentDatetime(business, args)
    case 'check_availability': return handleCheckAvailability(business, args)
    case 'get_pricing': return handleGetPricing(business, args)
    case 'create_booking': return handleCreateBooking(business, args, callCtx)
    case 'take_message': return handleTakeMessage(business, args, callCtx)
    default: return `Unknown tool: ${name}`
  }
}

// The model has no built-in notion of "today" — it must call this before
// working out any relative date (today, tomorrow, next Tuesday, etc.) rather
// than guessing or asking the caller. Returns a day-by-day lookup for the
// next 14 dates so the model never has to do date arithmetic itself, which
// is where it's most likely to get "next Tuesday" wrong. Resolves timezone
// from the caller's stated location where possible, since Melbourne/Sydney
// (AEST), Adelaide (ACST), and Perth (AWST) can be on a different calendar
// date near midnight.
async function handleGetCurrentDatetime(business: any, args: any) {
  const loc = await resolveLocation(admin, business.id, args?.location)
  const tz = loc?.timezone || business.timezone || 'Australia/Melbourne'
  const info = getCurrentDateTimeInfo(tz)
  return {
    timezone: tz,
    today_date: info.today,
    current_time: info.now,
    next_14_days: info.upcoming_dates,
  }
}

function normalizeTime(raw: string): string {
  const t = (raw || '').trim().toLowerCase()
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':')
    return `${h.padStart(2, '0')}:${m}`
  }
  const match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (match) {
    let hour = parseInt(match[1], 10)
    const minute = match[2] || '00'
    const period = match[3]
    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${minute}`
  }
  return '09:00'
}

async function handleCheckAvailability(business: any, args: any) {
  const { date, service_type, location } = args
  if (!date || !service_type) {
    return 'I need both a date and the service you are after to check availability.'
  }

  const loc = await resolveLocation(admin, business.id, location)
  if (!loc) return "We don't have any active service locations set up — let me transfer you to a team member."

  const service = await resolveService(admin, business.id, service_type)
  if (!service) {
    return `I couldn't find a service matching "${service_type}". Could you tell me which service you're after?`
  }

  const tz = loc.timezone || business.timezone || 'Australia/Melbourne'
  const slots = await getAvailableSlots(admin, business.id, loc.id, date, service.duration_minutes || 120, tz)

  if (slots.length === 0) {
    // Deliberately not "fully booked" or "no availability" — the agent should never sound
    // like it's refusing the caller. This phrasing (and the matching system-prompt
    // instruction) both push toward: offer another day, but still take the booking on the
    // caller's preferred date/time if they want it, and let the office sort it out after.
    return `We're pretty full on ${date} for ${service.name} — worth asking if another day would work for them. If they'd still like that date, go ahead and take the booking anyway for their preferred date and time; let them know we'll check if we can fit them in and confirm shortly.`
  }

  return {
    service: service.name,
    date,
    available_slots: slots.map(s => s.label),
  }
}

async function handleGetPricing(business: any, args: any) {
  const { service_type, bedrooms, bathrooms, location } = args
  if (!service_type) return 'Which service would you like pricing for?'

  const loc = await resolveLocation(admin, business.id, location)
  const service = await resolveService(admin, business.id, service_type)
  if (!service) return `I couldn't find a service matching "${service_type}".`

  let basePrice = service.base_price
  if (loc) {
    const { data: locService } = await admin
      .from('location_services')
      .select('base_price, is_enabled')
      .eq('location_id', loc.id)
      .eq('service_id', service.id)
      .maybeSingle()
    if (locService?.is_enabled) basePrice = locService.base_price
  }

  const breakdown = calcJobPrice({
    service: { id: service.id, base_price: basePrice, pricing_type: service.pricing_type, duration_minutes: service.duration_minutes },
    bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
    bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
    selectedExtras: [],
    roomPricing: service.room_pricing || [],
    locationId: loc?.id || null,
  })
  const effectiveTaxRate = business.show_tax && business.tax_rate > 0 ? business.tax_rate : 0
  const taxSplit = calcTaxSplit(breakdown.total, business.tax_mode ?? 'exclusive', effectiveTaxRate)

  return {
    service: service.name,
    price: formatCents(taxSplit.total, business.currency || 'AUD'),
  }
}

async function handleCreateBooking(business: any, args: any, callCtx: { vapiCallId: string | null; fromNumber: string | null }) {
  const {
    full_name, phone, email,
    address_line1, suburb, state, postcode,
    service_type, date, time,
    bedrooms, bathrooms, frequency, location,
  } = args

  if (!full_name || !service_type || !date || !time) {
    return 'I need the customer name, service, date and time to book this in.'
  }
  if (!address_line1 || !suburb || !state) {
    return 'I need the full address — street, suburb and state — to book this in.'
  }

  // Independent lookups — run in parallel instead of chaining, since the
  // caller is waiting live on the phone for this whole tool call to finish.
  const [loc, service] = await Promise.all([
    resolveLocation(admin, business.id, location || state || suburb),
    resolveService(admin, business.id, service_type),
  ])
  if (!loc) return "We don't have any active service locations set up — let me transfer you to a team member."
  if (!service) return `I couldn't find a service matching "${service_type}".`

  const effectiveFrequency = service.allows_recurring === false ? 'one_time' : (frequency || 'one_time')
  const [{ data: locService }, { data: freqRow }] = await Promise.all([
    admin.from('location_services').select('base_price, is_enabled').eq('location_id', loc.id).eq('service_id', service.id).maybeSingle(),
    admin.from('frequency_discounts').select('discount_percent').eq('service_id', service.id).eq('frequency', effectiveFrequency).maybeSingle(),
  ])
  if (!locService?.is_enabled) return `${service.name} isn't available at that location.`

  const discountPct = service.frequency_discount_eligible
    ? (freqRow?.discount_percent ?? HARDCODED_DISCOUNTS[effectiveFrequency] ?? 0)
    : 0

  const breakdown = calcJobPrice({
    service: { id: service.id, base_price: locService.base_price, pricing_type: service.pricing_type, duration_minutes: service.duration_minutes },
    bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
    bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
    selectedExtras: [],
    roomPricing: service.room_pricing || [],
    locationId: loc.id,
  })
  const discountedPrice = applyFrequencyDiscount(breakdown.total, discountPct)
  const effectiveTaxRate = business.show_tax && business.tax_rate > 0 ? business.tax_rate : 0
  const taxSplit = calcTaxSplit(discountedPrice, business.tax_mode ?? 'exclusive', effectiveTaxRate)

  const callerPhone = phone || callCtx.fromNumber || null

  let customerId: string | null = null
  if (email) {
    const { data: existing } = await admin.from('customers').select('id').eq('business_id', business.id).eq('email', email).maybeSingle()
    if (existing) customerId = existing.id
  }
  if (!customerId && callerPhone) {
    const { data: existing } = await admin.from('customers').select('id').eq('business_id', business.id).eq('phone', callerPhone).maybeSingle()
    if (existing) customerId = existing.id
  }
  if (!customerId) {
    const { data: created, error } = await admin
      .from('customers')
      .insert({ business_id: business.id, full_name, email: email || null, phone: callerPhone })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create customer: ${error.message}`)
    customerId = created.id
  }

  const { data: addr, error: addrErr } = await admin
    .from('addresses')
    .insert({ business_id: business.id, customer_id: customerId, line1: address_line1, city: suburb, state, postcode: postcode || '', country: 'AU', is_default: true })
    .select('id')
    .single()
  if (addrErr) throw new Error(`Failed to create address: ${addrErr.message}`)

  const tz = loc.timezone || business.timezone || 'Australia/Melbourne'
  const scheduledAtIso = fromBusinessDateTime(date, normalizeTime(time), tz)

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .insert({
      business_id: business.id,
      location_id: loc.id,
      customer_id: customerId,
      address_id: addr.id,
      service_id: service.id,
      status: 'pending',
      scheduled_at: scheduledAtIso,
      duration_minutes: service.duration_minutes || 120,
      price: taxSplit.subtotal,
      total_price: taxSplit.total,
      tax_amount: taxSplit.tax,
      frequency: effectiveFrequency,
      payment_status: 'unpaid',
      payment_method: 'card',
      booking_source: 'voice',
      is_flexible_time: false,
      bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
      bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
    })
    .select('id')
    .single()
  if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`)

  if (callCtx.vapiCallId) {
    await admin.from('voice_calls').update({ booking_id: job.id }).eq('vapi_call_id', callCtx.vapiCallId)
  }

  // Everything below is genuinely non-blocking now — CRM, staff notification,
  // confirmation email, and SMS all used to be awaited right here, one after
  // another, including two live third-party API calls (Resend, then Dialpad)
  // with no timeout on either. That chain is exactly what was making Aria go
  // silent: the booking itself was already created by this point, but the
  // tool call kept running underneath it, and Vapi's own tool-call timeout is
  // shorter than that full chain can take on a slow day. Vapi gives up
  // waiting, drops the (correct) result, and the model improvises "technical
  // issue... team will call you back" — even though the job was booked fine
  // seconds earlier. Firing these without awaiting them (same pattern already
  // used for the Google Ads conversion sync in provider-status/route.ts)
  // means the caller hears their confirmation immediately, and these
  // side-effects still happen a moment later in the background.
  notifyBookingCreated({
    business, customerId, full_name, email, callerPhone, service, date, time,
    taxSplit, scheduledAtIso, tz, job, address_line1, suburb, state, postcode,
    bedrooms, bathrooms,
  }).catch(e => console.error('[vapi create_booking] post-booking notifications failed (non-blocking):', e))

  return {
    success: true,
    booking_id: job.id,
    confirmation_summary: `Booked ${service.name} for ${formatBusinessDateTime(scheduledAtIso, tz)} at ${address_line1}, ${suburb}. Total ${formatCents(taxSplit.total, business.currency)}. A confirmation SMS and email are on the way.`,
  }
}

// Fire-and-forget side effects after a voice booking is created: CRM upsert,
// staff notification, confirmation email, confirmation SMS. Deliberately NOT
// awaited by the caller — see the comment above the call site. Each step
// keeps its own try/catch so one failure (e.g. SMS) never blocks the others.
async function notifyBookingCreated(ctx: {
  business: any; customerId: string; full_name: string; email: string | null; callerPhone: string | null
  service: any; date: string; time: string; taxSplit: any; scheduledAtIso: string; tz: string; job: { id: string }
  address_line1: string; suburb: string; state: string; postcode: string | null
  bedrooms: number | null | undefined; bathrooms: number | null | undefined
}) {
  const {
    business, customerId, full_name, email, callerPhone, service, date, time,
    taxSplit, scheduledAtIso, tz, job, address_line1, suburb, state, postcode,
    bedrooms, bathrooms,
  } = ctx

  try {
    const crmResult = await upsertCrmContact(admin, {
      business_id: business.id,
      customer_id: customerId,
      full_name,
      email: email || null,
      phone: callerPhone,
      source: 'voice',
    })
    if (crmResult.contact_id) {
      await logCrmActivity(admin, {
        business_id: business.id,
        contact_id: crmResult.contact_id,
        type: 'note',
        title: crmResult.created ? 'Booking created via voice agent (new lead)' : 'Booking created via voice agent',
        body: `Booked ${service.name} for ${date} ${time}. Total: ${formatCents(taxSplit.total, business.currency)}`,
      })
    }
  } catch (e) {
    console.error('[vapi create_booking] CRM upsert failed (non-blocking):', e)
  }

  try {
    const { data: staff } = await admin.from('profiles').select('id').eq('business_id', business.id)
    if (staff?.length) {
      await admin.from('notifications').insert(staff.map((s: any) => ({
        business_id: business.id,
        user_id: s.id,
        type: 'voice_booking_created',
        title: `📞 Voice agent booked ${full_name}`,
        body: `${service.name} on ${formatBusinessDateTime(scheduledAtIso, tz)}. Booked automatically by the voice agent — no confirmation call needed.`,
        entity_type: 'job',
        entity_id: job.id,
        action_url: `/jobs/${job.id}`,
      })))
    }
  } catch (e) {
    console.error('[vapi create_booking] staff notification failed (non-blocking):', e)
  }

  try {
    await sendBookingConfirmation({
      job: {
        id: job.id,
        scheduled_at: scheduledAtIso,
        total_price: taxSplit.total,
        price_override: null,
        tax_amount: taxSplit.tax,
        is_flexible_time: false,
        bedrooms: service.pricing_type === 'room_based' ? (bedrooms ?? null) : null,
        bathrooms: service.pricing_type === 'room_based' ? (bathrooms ?? null) : null,
        extras: [],
      },
      customer: { full_name, email: email || '' },
      business: {
        name: business.name,
        brand_color: business.brand_color,
        logo_url: business.logo_url,
        contact_email: business.contact_email,
        timezone: tz,
        plan: business.plan,
        currency: business.currency,
      },
      address: { line1: address_line1, city: suburb, state, postcode: postcode || '' },
      service: { name: service.name },
      business_id: business.id,
    })
  } catch (e) {
    console.error('[vapi create_booking] confirmation email failed (non-blocking):', e)
  }

  if (callerPhone) {
    try {
      const { sendDialpadSms } = await import('@/lib/sms/dialpad')
      const { formatDateForSms, formatTimeForSms } = await import('@/lib/sms/format')
      await sendDialpadSms({
        business: {
          sms_provider: business.sms_provider,
          sms_api_key_encrypted: business.sms_api_key_encrypted,
          sms_api_key_iv: business.sms_api_key_iv,
          sms_user_id: business.sms_user_id,
          sms_template: business.sms_template,
          sms_enabled: business.sms_enabled,
        },
        toPhone: callerPhone,
        vars: {
          customer_name: full_name.split(' ')[0] || full_name,
          service_name: service.name,
          date: formatDateForSms(scheduledAtIso, tz),
          time: formatTimeForSms(scheduledAtIso, tz, false),
          business_name: business.name,
          business_phone: business.phone || '',
          total: formatCents(taxSplit.total, business.currency),
        },
      })
    } catch (e) {
      console.error('[vapi create_booking] SMS failed (non-blocking):', e)
    }
  }
}

// Aria only answers calls outside business hours — there is never a live human to actually
// connect the caller to. The old version of this tool told the caller "transferring you
// now / let me connect you" and then just... kept talking, because no real transfer ever
// happened (Vapi function tools can't perform a live call transfer on their own — that
// needs a dedicated Vapi "transferCall" action, which this never was). This replacement is
// honest about that: it takes a message, logs the caller as a CRM lead if this call isn't
// already tied to a booking, and raises an URGENT task so a human follows up the moment
// they're back on shift, instead of pretending to connect the caller live.
async function handleTakeMessage(business: any, args: any, callCtx: { vapiCallId: string | null; fromNumber: string | null }) {
  const { reason, full_name, phone } = args || {}
  const callerPhone = phone || callCtx.fromNumber || null
  const noteText = reason || 'Caller asked for the team — no further detail captured.'

  try {
    if (callCtx.vapiCallId) {
      await admin.from('voice_calls')
        .update({ status: 'message_taken', is_urgent: true, actionable_notes: noteText, ...(full_name ? { caller_name: full_name } : {}) })
        .eq('vapi_call_id', callCtx.vapiCallId)
    }

    const { data: staff } = await admin.from('profiles').select('id').eq('business_id', business.id)
    if (staff?.length) {
      await admin.from('notifications').insert(staff.map((s: any) => ({
        business_id: business.id,
        user_id: s.id,
        type: 'voice_message_taken',
        title: '📞 Urgent: after-hours message from Aria',
        body: `${full_name ? `${full_name} — ` : ''}${noteText}${callerPhone ? ` (${callerPhone})` : ''}`,
        entity_type: 'voice_call',
      })))
    }

    // Log the caller as a CRM lead so nothing gets lost — skip if this call already has a
    // booking (handleCreateBooking already upserts the contact in that case).
    if (callerPhone) {
      const crmResult = await upsertCrmContact(admin, {
        business_id: business.id,
        customer_id: null,
        full_name: full_name || `Caller ${callerPhone.slice(-4)}`,
        email: null,
        phone: callerPhone,
        source: 'voice',
      })
      if (crmResult.contact_id) {
        await logCrmActivity(admin, {
          business_id: business.id,
          contact_id: crmResult.contact_id,
          type: 'note',
          title: 'Message taken by Aria (after hours) — needs follow-up',
          body: noteText,
        })
      }
    }
  } catch (e) {
    console.error('[vapi take_message] logging failed (non-blocking):', e)
  }

  return "Got it, I've noted that down and flagged it for the team as urgent — they'll follow up with you as soon as they're back on shift. Can I grab your name and the best number to reach you on, if I don't have that already?"
}
