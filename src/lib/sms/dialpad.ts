import { decrypt } from '@/lib/crypto'
import { normalizeAuPhone } from './phone'

export interface BusinessSmsConfig {
  sms_provider: string | null
  sms_api_key_encrypted: string | null
  sms_api_key_iv: string | null
  sms_user_id: string | null
  sms_template: string | null
  sms_enabled: boolean
}

export interface SmsTemplateVars {
  customer_name: string
  service_name: string
  date: string         // pre-formatted in business timezone, e.g. "Mon 12 May"
  time: string         // pre-formatted, e.g. "10:30 AM" or "Flexible time"
  business_name: string
  business_phone: string
  // NEW (for contact upsert; optional)
  customer_id?: string
  customer_first_name?: string
  customer_last_name?: string
  customer_email?: string
}

export interface UpsertDialpadContactParams {
  apiKey: string                 // already decrypted (caller's responsibility)
  uid: string                    // YOUR stable identifier for this contact (we use bookdin-cust-{customer_id})
  firstName: string
  lastName?: string
  phone: string                  // E.164 format
  email?: string
  companyName?: string
}

export interface UpsertDialpadContactResult {
  status: 'upserted' | 'failed' | 'skipped'
  error?: string
  contact_id?: string
}

/**
 * Idempotently upserts a contact in Dialpad. Uses the "create_with_uid" endpoint
 * which treats the same uid as upsert. Safe to call repeatedly for the same customer.
 *
 * Errors are returned, never thrown. Non-blocking by design — caller continues even on failure.
 */
export async function upsertDialpadContact(p: UpsertDialpadContactParams): Promise<UpsertDialpadContactResult> {
  if (!p.apiKey) return { status: 'skipped', error: 'no api key' }
  if (!p.uid) return { status: 'skipped', error: 'no uid' }
  if (!p.phone) return { status: 'skipped', error: 'no phone' }
  if (!p.phone.startsWith('+')) return { status: 'skipped', error: `phone not E.164: ${p.phone}` }

  const url = `https://dialpad.com/api/v2/contacts/${encodeURIComponent(p.uid)}`

  const body: Record<string, any> = {
    first_name: p.firstName || 'Customer',
    phones: [p.phone],
  }
  if (p.lastName) body.last_name = p.lastName
  if (p.email) body.emails = [p.email]
  if (p.companyName) body.company_name = p.companyName

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${p.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '<no body>')
      return {
        status: 'failed',
        error: `dialpad contacts http ${response.status}: ${errText.slice(0, 500)}`,
      }
    }

    const data = await response.json().catch(() => null)
    return {
      status: 'upserted',
      contact_id: data?.id ? String(data.id) : undefined,
    }
  } catch (err: any) {
    return { status: 'failed', error: `network: ${err.message}` }
  }
}

const DEFAULT_TEMPLATE = "Hi {{customer_name}}, Thanks so much for booking with {{business_name}}! All details can be found in your confirmation email. Don't hesitate to reach out if you have any questions. We look forward to working with you!"

export function renderTemplate(template: string, vars: SmsTemplateVars): string {
  return template
    .replace(/\{\{customer_name\}\}/g, vars.customer_name)
    .replace(/\{\{service_name\}\}/g, vars.service_name)
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{time\}\}/g, vars.time)
    .replace(/\{\{business_name\}\}/g, vars.business_name)
    .replace(/\{\{business_phone\}\}/g, vars.business_phone)
}

export interface SendDialpadSmsParams {
  business: BusinessSmsConfig
  toPhone: string         // E.164 format (e.g. +61412345678)
  vars: SmsTemplateVars
}

export interface SendDialpadSmsResult {
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  message_id?: string
  rendered_text?: string  // for audit/debug
}

/**
 * Send an SMS via Dialpad on behalf of a business.
 * Always returns a result object — never throws. Caller decides whether to surface errors.
 */
export async function sendDialpadSms(params: SendDialpadSmsParams): Promise<SendDialpadSmsResult> {
  const { business, toPhone, vars } = params

  // Skip if config is incomplete or disabled
  if (!business.sms_enabled) return { status: 'skipped', error: 'sms_enabled is false' }
  if (business.sms_provider !== 'dialpad') return { status: 'skipped', error: `unsupported provider: ${business.sms_provider}` }
  if (!business.sms_api_key_encrypted || !business.sms_api_key_iv) return { status: 'skipped', error: 'missing api key' }
  if (!business.sms_user_id) return { status: 'skipped', error: 'missing user_id' }
  if (!toPhone) return { status: 'skipped', error: 'missing recipient phone' }

  const template = business.sms_template || DEFAULT_TEMPLATE
  const text = renderTemplate(template, vars)

  let apiKey: string
  try {
    apiKey = decrypt(business.sms_api_key_encrypted, business.sms_api_key_iv)
  } catch (err: any) {
    return { status: 'failed', error: `decrypt failed: ${err.message}`, rendered_text: text }
  }

  const normalizedPhone = normalizeAuPhone(toPhone)
  if (!normalizedPhone) {
    return { status: 'failed', error: `phone could not be normalized to E.164: ${toPhone}`, rendered_text: text }
  }

  // Best-effort: upsert the contact in Dialpad so it's saved under the customer's real name.
  // Non-blocking — any failure is logged and ignored, the SMS still attempts to send.
  if (vars.customer_id && vars.customer_first_name) {
    try {
      const contactResult = await upsertDialpadContact({
        apiKey,
        uid: `bookdin-cust-${vars.customer_id}`,
        firstName: vars.customer_first_name,
        lastName: vars.customer_last_name,
        phone: normalizedPhone,
        email: vars.customer_email,
        companyName: vars.business_name,
      })
      if (contactResult.status === 'failed') {
        console.warn('Dialpad contact upsert failed (non-blocking):', contactResult.error)
      }
    } catch (err: any) {
      console.warn('Dialpad contact upsert threw (non-blocking):', err.message)
    }
  }

  try {
    const response = await fetch('https://dialpad.com/api/v2/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: business.sms_user_id,
        to_numbers: [normalizedPhone],
        text,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '<no body>')
      return {
        status: 'failed',
        error: `dialpad http ${response.status}: ${body.slice(0, 500)}`,
        rendered_text: text,
      }
    }

    const data = await response.json().catch(() => null)
    return {
      status: 'sent',
      message_id: data?.id ? String(data.id) : undefined,
      rendered_text: text,
    }
  } catch (err: any) {
    return { status: 'failed', error: `network: ${err.message}`, rendered_text: text }
  }
}
