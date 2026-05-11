// src/lib/bookings/submissionStore.ts
//
// Helpers for the write-first booking submission audit log.
// Use the service-role Supabase client (bypasses RLS).

import type { SupabaseClient } from '@supabase/supabase-js';

export type SubmissionSource = 'public' | 'admin';
export type SubmissionStatus = 'received' | 'processed' | 'failed';

export interface ProcessingLogEntry {
  step: string;
  status: 'ok' | 'failed';
  duration_ms?: number;
  error?: string;
  ts: string;
}

export interface CreateSubmissionParams {
  businessId: string;
  locationId?: string | null;
  source: SubmissionSource;
  rawPayload: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Insert a new submission row with status='received'.
 * Throws on failure — caller should return 503 to client (fail closed).
 */
export async function createSubmission(
  supabase: SupabaseClient,
  params: CreateSubmissionParams
): Promise<string> {
  const { data, error } = await supabase
    .from('booking_submissions')
    .insert({
      business_id: params.businessId,
      location_id: params.locationId ?? null,
      source: params.source,
      raw_payload: params.rawPayload,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      status: 'received',
      processing_log: [],
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create booking submission: ${error?.message ?? 'unknown'}`);
  }
  return data.id;
}

/**
 * Append a step to processing_log. Non-throwing.
 */
export async function logStep(
  supabase: SupabaseClient,
  submissionId: string,
  entry: Omit<ProcessingLogEntry, 'ts'>
): Promise<void> {
  try {
    const fullEntry: ProcessingLogEntry = { ...entry, ts: new Date().toISOString() };

    const { data: current } = await supabase
      .from('booking_submissions')
      .select('processing_log')
      .eq('id', submissionId)
      .single();

    const log = Array.isArray(current?.processing_log) ? current.processing_log : [];
    log.push(fullEntry);

    await supabase
      .from('booking_submissions')
      .update({ processing_log: log })
      .eq('id', submissionId);
  } catch (e) {
    console.error('[submissionStore] logStep failed (non-fatal):', e);
  }
}

/**
 * Mark submission processed and link to job. Non-throwing.
 */
export async function markProcessed(
  supabase: SupabaseClient,
  submissionId: string,
  jobId: string
): Promise<void> {
  try {
    await supabase
      .from('booking_submissions')
      .update({
        status: 'processed',
        job_id: jobId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', submissionId);
  } catch (e) {
    console.error('[submissionStore] markProcessed failed (non-fatal):', e);
  }
}

/**
 * Mark submission failed with error message. Non-throwing.
 */
export async function markFailed(
  supabase: SupabaseClient,
  submissionId: string,
  errorMessage: string
): Promise<void> {
  try {
    await supabase
      .from('booking_submissions')
      .update({
        status: 'failed',
        error_message: errorMessage.slice(0, 2000),
        processed_at: new Date().toISOString(),
      })
      .eq('id', submissionId);
  } catch (e) {
    console.error('[submissionStore] markFailed failed (non-fatal):', e);
  }
}
