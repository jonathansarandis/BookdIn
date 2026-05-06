// @ts-nocheck
'use client'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { X, MapPin, User, Briefcase, Clock } from 'lucide-react'
import { formatBusinessDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const STATUS_CHIP: Record<string, string> = {
  pending:     'bg-amber-100 text-amber-800',
  confirmed:   'bg-green-100 text-green-800',
  assigned:    'bg-purple-100 text-purple-800',
  on_the_way:  'bg-blue-100 text-blue-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed:   'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  assigned:    'Assigned',
  on_the_way:  'On the way',
  in_progress: 'In progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
}

const PAYMENT_CHIP: Record<string, string> = {
  paid:     'bg-green-100 text-green-700',
  unpaid:   'bg-yellow-100 text-yellow-700',
  pending:  'bg-yellow-100 text-yellow-700',
  refunded: 'bg-gray-100 text-gray-600',
  failed:   'bg-red-100 text-red-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  paid:     'Paid',
  unpaid:   'Unpaid',
  pending:  'Awaiting payment',
  refunded: 'Refunded',
  failed:   'Payment failed',
}

const FREQUENCY_LABELS: Record<string, string> = {
  one_time:    'One-time',
  weekly:      'Weekly',
  fortnightly: 'Fortnightly',
  monthly:     'Monthly',
}

interface Props {
  job: any | null
  businessTimezone: string
  onClose: () => void
}

export default function JobPopover({ job, businessTimezone, onClose }: Props) {
  const startTimeStr = job ? formatBusinessDateTime(job.scheduled_at, businessTimezone, 'h:mm a') : ''
  const endTimeStr = job?.duration_minutes
    ? formatBusinessDateTime(
        new Date(new Date(job.scheduled_at).getTime() + job.duration_minutes * 60_000).toISOString(),
        businessTimezone,
        'h:mm a'
      )
    : null
  const timeRange = endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr
  const dateStr = job ? formatBusinessDateTime(job.scheduled_at, businessTimezone, 'EEEE, d MMMM yyyy') : ''
  const paymentStatus = job?.payment_status || 'unpaid'

  return (
    <Dialog.Root open={!!job} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content
          className={cn(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100vw-2rem)] sm:max-w-md',
            'bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden',
            'focus:outline-none animate-fade-in'
          )}
        >
          <Dialog.Title className="sr-only">
            Booking {job?.id?.slice(0, 8).toUpperCase()}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Booking details for {job?.customer?.full_name}
          </Dialog.Description>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-xs text-gray-400 font-mono">
              #{job?.id?.slice(0, 8).toUpperCase()}
            </span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CHIP[job?.status] || 'bg-gray-100 text-gray-600')}>
              {STATUS_LABELS[job?.status] || job?.status}
            </span>
            <div className="flex items-center gap-3">
              <Link
                href={`/jobs/${job?.id}`}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline whitespace-nowrap"
              >
                Open Booking →
              </Link>
              <Dialog.Close asChild>
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">

            {/* Customer */}
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{job?.customer?.full_name || '—'}</p>
                {job?.customer?.email && <p className="text-xs text-gray-500">{job.customer.email}</p>}
                {job?.customer?.phone && <p className="text-xs text-gray-500">{job.customer.phone}</p>}
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-900">{dateStr}</p>
                <p className="text-xs text-gray-500">{timeRange}</p>
                {job?.frequency && job.frequency !== 'one_time' && (
                  <p className="text-xs text-gray-400 mt-0.5">{FREQUENCY_LABELS[job.frequency] || job.frequency}</p>
                )}
              </div>
            </div>

            {/* Address */}
            {job?.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  {job.address.line1}, {job.address.city} {job.address.state} {job.address.postcode}
                </p>
              </div>
            )}

            {/* Provider */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                style={{ backgroundColor: job?.provider?.color || '#d1d5db' }}
              />
              {job?.provider ? (
                <p className="text-sm text-gray-700 font-medium">{job.provider.display_name}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Unassigned</p>
              )}
            </div>

            {/* Service + room counts + extras */}
            <div className="flex items-start gap-2.5">
              <Briefcase className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-900 font-medium">{job?.service?.name || '—'}</p>
                {job?.service?.pricing_type === 'room_based' && (job?.bedrooms || job?.bathrooms) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[
                      job.bedrooms && `${job.bedrooms} bed`,
                      job.bathrooms && `${job.bathrooms} bath`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                {job?.job_extras?.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {job.job_extras.map((ex: any) => (
                      <p key={ex.id || ex.name} className="text-xs text-gray-400">
                        + {ex.name} · ${(ex.price / 100).toFixed(2)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm font-semibold text-gray-900">
              ${((job?.total_price || job?.price || 0) / 100).toFixed(2)}
            </p>
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', PAYMENT_CHIP[paymentStatus] || 'bg-gray-100 text-gray-600')}>
              {PAYMENT_LABELS[paymentStatus] || paymentStatus}
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
