import type { SupabaseClient } from '@supabase/supabase-js'

export interface UpsertCrmContactParams {
  business_id: string
  customer_id: string
  full_name: string
  email?: string | null
  phone?: string | null
  source: 'website' | 'admin' | 'import' | 'recurring' | string  // open enum
}

export interface UpsertCrmContactResult {
  contact_id: string | null
  created: boolean  // true if we inserted; false if we matched an existing contact
  error?: string
}

/**
 * Find-or-create a crm_contacts row. Matches by email OR phone within the same business.
 * If a match exists, returns its id and updates last_activity_at + customer_id (in case the
 * existing CRM contact wasn't linked yet). If no match, creates a new lead.
 *
 * Caller is responsible for calling logCrmActivity() afterward with whatever details apply
 * to the specific booking (date, service, total, etc).
 *
 * Returns a result object — never throws. Caller decides whether to surface errors.
 */
export async function upsertCrmContact(
  supabase: SupabaseClient,
  params: UpsertCrmContactParams
): Promise<UpsertCrmContactResult> {
  const { business_id, customer_id, full_name, email, phone, source } = params

  let existingId: string | null = null

  // Try email match first (most reliable identifier)
  if (email) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('business_id', business_id)
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[crm] email lookup failed:', error.message)
    } else if (data) {
      existingId = data.id
    }
  }

  // Fall back to phone match if no email hit
  if (!existingId && phone) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('business_id', business_id)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[crm] phone lookup failed:', error.message)
    } else if (data) {
      existingId = data.id
    }
  }

  const now = new Date().toISOString()
  const nowDate = new Date()
  const followupDate = new Date(nowDate)
  if (nowDate.getHours() >= 14) {
    followupDate.setDate(followupDate.getDate() + 1)
    followupDate.setHours(9, 0, 0, 0)
  } else {
    followupDate.setHours(15, 0, 0, 0)
  }

  if (existingId) {
    // Update existing contact's activity timestamp + link customer_id if missing
    const { error: updateError } = await supabase
      .from('crm_contacts')
      .update({
        customer_id,
        last_activity_at: now,
        next_followup_at: followupDate.toISOString(),
      })
      .eq('id', existingId)
    if (updateError) {
      return { contact_id: existingId, created: false, error: `update failed: ${updateError.message}` }
    }
    return { contact_id: existingId, created: false }
  }

  // No match — create new lead
  const { data: created, error: insertError } = await supabase
    .from('crm_contacts')
    .insert({
      business_id,
      customer_id,
      full_name,
      email: email || null,
      phone: phone || null,
      source,
      stage: 'lead',
      last_activity_at: now,
      next_followup_at: followupDate.toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    return { contact_id: null, created: false, error: `insert failed: ${insertError.message}` }
  }
  return { contact_id: created.id, created: true }
}

export interface LogCrmActivityParams {
  business_id: string
  contact_id: string
  type: 'note' | 'call' | 'email' | 'sms' | 'task' | string
  title: string
  body?: string
}

/**
 * Log a CRM activity row. Best-effort — failures are logged but not thrown.
 */
export async function logCrmActivity(
  supabase: SupabaseClient,
  params: LogCrmActivityParams
): Promise<void> {
  const { error } = await supabase.from('crm_activities').insert({
    business_id: params.business_id,
    contact_id: params.contact_id,
    type: params.type,
    title: params.title,
    body: params.body || null,
  })
  if (error) {
    console.error('[crm] activity log failed:', error.message)
  }
}
