// @ts-nocheck
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined, currency = 'AUD'): string {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100) // amounts stored in cents
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, yyyy · h:mm a')
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d')
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(typeof date === 'string' ? new Date(date) : date, { addSuffix: true })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  on_the_way: 'On the way',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  no_show: 'No show',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  pending:     'bg-amber-50 text-amber-800 border-amber-200',
  confirmed:   'bg-green-50 text-green-800 border-green-200',
  assigned:    'bg-purple-50 text-purple-800 border-purple-200',
  on_the_way:  'bg-blue-50 text-blue-800 border-blue-200',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-200',
  completed:   'bg-gray-100 text-gray-700 border-gray-200',
  cancelled:   'bg-red-50 text-red-800 border-red-200',
  rescheduled: 'bg-orange-50 text-orange-800 border-orange-200',
  no_show:     'bg-red-50 text-red-800 border-red-200',
}

export const FREQUENCY_LABELS: Record<string, string> = {
  one_time:    'One-time',
  weekly:      'Weekly',
  fortnightly: 'Fortnightly',
  monthly:     'Monthly',
  custom:      'Custom',
}
