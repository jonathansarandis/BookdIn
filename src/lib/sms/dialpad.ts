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
