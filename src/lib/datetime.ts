import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz'

/**
 * Converts a UTC ISO string from the database to a Date object whose local
 * accessors (getDate, getHours, etc.) reflect the BUSINESS timezone, not the
 * server's or browser's timezone.
 *
 * Example:
 *   A Melbourne booking stored as "2026-05-06T23:00:00Z" (= Melbourne May 7 9am AEST).
 *   toBusinessDateTime("2026-05-06T23:00:00Z", "Australia/Melbourne")
 *   → Date where .getDate() === 7, .getHours() === 9  ✓
 *
 *   Without this, new Date("2026-05-06T23:00:00Z").getDate() on a UTC server
 *   returns 6 — one day early, causing the calendar to show it on the wrong day.
 */
export function toBusinessDateTime(utcIsoString: string, businessTimezone: string): Date {
  return toZonedTime(new Date(utcIsoString), businessTimezone)
}

/**
 * Converts a local date + time pair from a form input to a UTC ISO string for
 * storage, treating the input as local time in the BUSINESS timezone.
 *
 * Example:
 *   Philippines VA picks "2026-05-07" and "09:00" for a Melbourne business.
 *   fromBusinessDateTime("2026-05-07", "09:00", "Australia/Melbourne")
 *   → "2026-05-06T23:00:00.000Z"  ✓  (9am Melbourne AEST = UTC−10h)
 *
 *   Without this, new Date("2026-05-07T09:00:00").toISOString() in a Philippines
 *   browser returns "2026-05-07T01:00:00.000Z" — 2 hours off. The 7am slot
 *   crosses UTC midnight entirely: "2026-05-07T07:00:00" Philippines →
 *   "2026-05-06T23:00:00Z", which the UTC-based calendar assigns to May 6
 *   (today) instead of May 7 (tomorrow).
 */
export function fromBusinessDateTime(
  localDateStr: string,
  localTimeStr: string,
  businessTimezone: string,
): string {
  return fromZonedTime(`${localDateStr}T${localTimeStr}:00`, businessTimezone).toISOString()
}

/**
 * Formats a UTC ISO string as a human-readable string in the business timezone.
 * Default format: "Wed 7 May 2026, 9:00 AM"
 */
export function formatBusinessDateTime(
  utcIsoString: string,
  businessTimezone: string,
  formatStr = 'EEE d MMM yyyy, h:mm a',
): string {
  return formatInTimeZone(new Date(utcIsoString), businessTimezone, formatStr)
}
