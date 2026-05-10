export function formatDateForSms(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  // e.g. "Mon, 12 May"
}

export function formatTimeForSms(iso: string, tz: string, isFlexible: boolean): string {
  if (isFlexible) return 'Flexible time'
  return new Date(iso).toLocaleTimeString('en-AU', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  // e.g. "10:30 am"
}
