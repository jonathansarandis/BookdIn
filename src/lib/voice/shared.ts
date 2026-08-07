// Shared helpers for the Vapi voice-agent integration. Used by the tool-call
// webhook, the call-events webhook, and the assistant-creation endpoint.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function resolveBusinessByAssistantId(admin: SupabaseClient, assistantId: string | null | undefined) {
  if (!assistantId) return null
  const { data } = await admin
    .from('businesses')
    .select('*')
    .eq('vapi_assistant_id', assistantId)
    .maybeSingle()
  return data ?? null
}

export async function resolveBusinessByPhoneNumber(admin: SupabaseClient, phoneNumber: string | null | undefined) {
  if (!phoneNumber) return null
  const { data } = await admin
    .from('businesses')
    .select('*')
    .eq('voice_phone_number', phoneNumber)
    .maybeSingle()
  return data ?? null
}

/**
 * Vapi's tool-call webhook nests the call/assistant identifiers a few different
 * ways depending on event version. We don't have a live Vapi account to verify
 * the exact shape against, so this reads every path we've seen documented and
 * falls back gracefully. assistantId is the primary business-resolution key
 * (set on businesses.vapi_assistant_id when the assistant is created); the
 * dialed number is a fallback for older/alternate payload shapes.
 */
export function extractCallInfo(body: any) {
  const call = body?.message?.call ?? body?.call ?? {}
  const assistantId: string | null =
    call?.assistantId ?? body?.message?.assistant?.id ?? body?.assistant?.id ?? null
  const vapiCallId: string | null = call?.id ?? body?.message?.call?.id ?? null
  const fromNumber: string | null =
    call?.customer?.number ?? body?.message?.customer?.number ?? null
  const toNumber: string | null =
    call?.phoneNumber?.number ?? body?.message?.phoneNumber?.number ?? null
  return { assistantId, vapiCallId, fromNumber, toNumber }
}

export interface NormalizedToolCall {
  id: string
  name: string
  args: Record<string, any>
}

/**
 * Normalizes both the current "tool-calls" webhook format
 * (message.toolCallList: [{ id, function: { name, arguments } }]) and the
 * older single "function-call" format (message.functionCall: { name, parameters })
 * into one shape. `arguments`/`parameters` may arrive as a JSON string or an
 * already-parsed object depending on the Vapi SDK version — both are handled.
 */
export function extractToolCalls(body: any): NormalizedToolCall[] {
  const message = body?.message ?? {}

  if (Array.isArray(message.toolCallList) && message.toolCallList.length > 0) {
    return message.toolCallList.map((tc: any) => ({
      id: tc.id,
      name: tc.name ?? tc.function?.name,
      args: parseArgs(tc.arguments ?? tc.function?.arguments),
    }))
  }

  if (Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
    return message.toolCalls.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name ?? tc.name,
      args: parseArgs(tc.function?.arguments ?? tc.arguments),
    }))
  }

  if (message.functionCall) {
    return [{
      id: message.functionCall.id ?? 'legacy-call',
      name: message.functionCall.name,
      args: parseArgs(message.functionCall.parameters),
    }]
  }

  return []
}

function parseArgs(raw: any): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Resolves which location a call should book against.
 * - Single-location businesses: always use the only active location.
 * - Multi-location: match `hint` (a suburb/city the caller mentioned, e.g.
 *   "Melbourne" or "Perth") against location names; falls back to the first
 *   active location if no hint matches, so the call can still proceed.
 */
export async function resolveLocation(admin: SupabaseClient, businessId: string, hint?: string | null) {
  const { data: locations } = await admin
    .from('locations')
    .select('id, name, timezone')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (!locations || locations.length === 0) return null
  if (locations.length === 1) return locations[0]

  if (hint) {
    const match = locations.find((l: any) => l.name?.toLowerCase().includes(hint.toLowerCase()))
    if (match) return match
  }
  return locations[0]
}

export async function resolveService(admin: SupabaseClient, businessId: string, serviceTypeHint: string) {
  const { data: services } = await admin
    .from('services')
    .select('*, room_pricing(*)')
    .eq('business_id', businessId)
    .ilike('name', `%${serviceTypeHint}%`)
    .limit(1)
  return services?.[0] ?? null
}

export function formatCents(cents: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100)
}
