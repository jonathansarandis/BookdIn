import type { SupabaseClient } from '@supabase/supabase-js'
import { fromBusinessDateTime, formatBusinessDateTime } from '@/lib/datetime'

// No business_hours config exists yet anywhere in the schema — this is a
// reasonable default (8am–6pm) until a real settings field is added.
const HOURS_START = 8
const HOURS_END = 18
const SLOT_STEP_MINUTES = 60
const MAX_SLOTS_RETURNED = 6

export interface AvailableSlot {
  iso: string
  label: string // e.g. "Thursday 9:00 AM"
}

/**
 * Generates candidate slots for a given local date at hourly intervals within
 * business hours, excludes anything overlapping an existing (non-cancelled)
 * job at that location, and drops past times when the date is today.
 */
export async function getAvailableSlots(
  admin: SupabaseClient,
  businessId: string,
  locationId: string,
  dateStr: string,
  durationMinutes: number,
  timezone: string,
): Promise<AvailableSlot[]> {
  const dayStartIso = fromBusinessDateTime(dateStr, '00:00', timezone)
  const dayEndIso = fromBusinessDateTime(dateStr, '23:59', timezone)

  const { data: existingJobs } = await admin
    .from('jobs')
    .select('scheduled_at, duration_minutes')
    .eq('business_id', businessId)
    .eq('location_id', locationId)
    .gte('scheduled_at', dayStartIso)
    .lte('scheduled_at', dayEndIso)
    .neq('status', 'cancelled')

  const busy = (existingJobs || []).map((j: any) => {
    const start = new Date(j.scheduled_at).getTime()
    const end = start + (j.duration_minutes || 120) * 60_000
    return { start, end }
  })

  const now = Date.now()
  const durationHours = Math.ceil(durationMinutes / 60)
  const slots: AvailableSlot[] = []

  for (let hour = HOURS_START; hour + durationHours <= HOURS_END; hour++) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`
    const startIso = fromBusinessDateTime(dateStr, timeStr, timezone)
    const startMs = new Date(startIso).getTime()
    if (startMs < now) continue

    const endMs = startMs + durationMinutes * 60_000
    const overlaps = busy.some(b => startMs < b.end && endMs > b.start)
    if (overlaps) continue

    slots.push({
      iso: startIso,
      label: formatBusinessDateTime(startIso, timezone, 'EEEE h:mm a'),
    })
    if (slots.length >= MAX_SLOTS_RETURNED) break
  }

  return slots
}

export { SLOT_STEP_MINUTES }
