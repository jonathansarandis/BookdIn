import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdvanceCrmStageParams {
  businessId: string
  customerId: string
  toStage: 'contacted' | 'quoted' | 'won' | 'lost'
  /** Stages the contact must NOT currently be in for this transition to apply —
   *  keeps automation from regressing a contact that's already further along
   *  (e.g. a re-sent quote shouldn't re-log "moved to Quoted", and a single
   *  cancelled job for an already-Won customer shouldn't undo that relationship). */
  excludeStages: string[]
  activityType: string
  activityTitle: string
  activityBody?: string
  lostReason?: string | null
  lostReasonNotes?: string | null
}

export interface AdvanceCrmStageResult {
  contactId: string | null
  moved: boolean
}

/**
 * Best-effort automatic stage transition — looks up the CRM contact linked to this
 * customer (by customer_id, same linkage upsertCrmContact maintains) and moves it
 * forward a stage, logging the transition as an activity. Never throws; callers
 * treat this the same as upsertCrmContact/logCrmActivity — a booking/quote action
 * should still succeed even if CRM bookkeeping fails.
 */
export async function advanceCrmStage(
  supabase: SupabaseClient,
  params: AdvanceCrmStageParams,
): Promise<AdvanceCrmStageResult> {
  const { data: contact, error: lookupError } = await supabase
    .from('crm_contacts')
    .select('id, stage')
    .eq('business_id', params.businessId)
    .eq('customer_id', params.customerId)
    .maybeSingle()

  if (lookupError) {
    console.error('[crm/stageAutomation] lookup failed:', lookupError.message)
    return { contactId: null, moved: false }
  }
  if (!contact) return { contactId: null, moved: false }
  if (params.excludeStages.includes(contact.stage)) return { contactId: contact.id, moved: false }

  const updates: Record<string, any> = { stage: params.toStage, last_activity_at: new Date().toISOString() }
  if (params.toStage === 'lost') {
    updates.lost_reason = params.lostReason ?? null
    updates.lost_reason_notes = params.lostReasonNotes ?? null
  }

  const { error: updateError } = await supabase.from('crm_contacts').update(updates).eq('id', contact.id)
  if (updateError) {
    console.error('[crm/stageAutomation] update failed:', updateError.message)
    return { contactId: contact.id, moved: false }
  }

  const { error: activityError } = await supabase.from('crm_activities').insert({
    business_id: params.businessId,
    contact_id: contact.id,
    type: params.activityType,
    title: params.activityTitle,
    body: params.activityBody || null,
  })
  if (activityError) {
    console.error('[crm/stageAutomation] activity log failed:', activityError.message)
  }

  return { contactId: contact.id, moved: true }
}
