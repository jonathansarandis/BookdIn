// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Loader2 } from 'lucide-react'
import { JOB_STATUS_LABELS } from '@/lib/utils'
import { advanceCrmStage } from '@/lib/crm/stageAutomation'
import ConfirmDeleteModal from '@/components/crm/ConfirmDeleteModal'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:     ['confirmed'],
  confirmed:   ['assigned', 'rescheduled'],
  assigned:    ['on_the_way', 'rescheduled'],
  on_the_way:  ['in_progress'],
  in_progress: ['completed', 'no_show'],
  completed:   [],
  cancelled:   [],
  rescheduled: ['confirmed'],
  no_show:     [],
}

interface Props {
  jobId: string
  currentStatus: string
  providers: { id: string; display_name: string }[]
  currentProviderId: string | null
  customerId?: string | null
  businessId?: string | null
  scheduledAt?: string | null
  timezone?: string
}

// Compares calendar dates in the job's own timezone — not a raw timestamp diff — so a
// job scheduled for earlier today is still completable; only a date that hasn't
// arrived yet is blocked. Mirrors the same guard added to the provider-status API
// route, after a subcontractor accidentally marked a job scheduled for 15 Sept
// completed while working on the 10th, which silently dropped it off the upcoming
// list until the actual day.
function isDateInFuture(scheduledAt: string | null | undefined, timezone: string) {
  if (!scheduledAt) return false
  const jobDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(scheduledAt))
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return jobDate > todayDate
}

export function CancelBookingButton({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const isDisabled = ['completed', 'cancelled'].includes(status)

  async function handleCancel(notify: boolean) {
    setLoading(true)
    const res = await fetch(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify }),
    })
    const data = await res.json()
    setLoading(false)
    setShowModal(false)
    if (!res.ok) {
      alert('Failed to cancel booking. Please try again.')
      return
    }
    if (data.emailStatus === 'failed') {
      alert('Booking cancelled, but confirmation email failed to send.')
    } else {
      alert('Booking cancelled.')
    }
    router.refresh()
  }

  if (isDisabled) {
    return (
      <span className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed select-none">
        Cancel
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {loading ? 'Cancelling...' : 'Cancel'}
      </button>
      {showModal && (
        <ConfirmDeleteModal
          title="Cancel this booking?"
          message="This marks the booking as cancelled and cannot be undone here."
          confirmLabel="Cancel booking"
          checkboxLabel="Send cancellation email to customer"
          checkboxDefault={true}
          onCancel={() => setShowModal(false)}
          onConfirm={handleCancel}
        />
      )}
    </>
  )
}

export default function JobStatusUpdater({ jobId, currentStatus, providers, currentProviderId, customerId, businessId, scheduledAt, timezone }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(currentProviderId || '')
  const [open, setOpen] = useState(false)

  const jobIsFuture = isDateInFuture(scheduledAt, timezone || 'Australia/Melbourne')
  const nextStatuses = (STATUS_TRANSITIONS[currentStatus] || []).filter(s => s !== 'completed' || !jobIsFuture)

  async function updateStatus(newStatus: string) {
    // Belt-and-braces alongside the dropdown filter above (which already hides this
    // option) — this writes straight to Supabase from the browser rather than through
    // an API route, so there's no server-side check unless it's here too.
    if (newStatus === 'completed' && jobIsFuture) {
      alert("This job isn't scheduled until its date arrives — it can't be marked completed early.")
      return
    }
    setLoading(true)
    const supabase = createClient()

    await supabase.from('jobs').update({
      status: newStatus,
      ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', jobId)

    await supabase.from('activity_logs').insert({
      business_id: (await supabase.from('jobs').select('business_id').eq('id', jobId).single()).data?.business_id,
      event_type: `job_${newStatus}`,
      description: `Job status changed to ${JOB_STATUS_LABELS[newStatus]}`,
      entity_type: 'job',
      entity_id: jobId,
    })

    // A confirmed booking is the strongest possible signal a lead converted —
    // moves the CRM contact to Won from any prior stage (including a stale
    // "lost" one, since re-confirming is a genuine win-back).
    if (newStatus === 'confirmed' && customerId && businessId) {
      await advanceCrmStage(supabase, {
        businessId,
        customerId,
        toStage: 'won',
        excludeStages: ['won'],
        activityType: 'won',
        activityTitle: 'Booking confirmed',
      })
    }

    // Best-effort, fire-and-forget: uploads this job's gclid (if any) to
    // Google Ads as an offline conversion so paying customers are counted
    // separately from leads who never proceeded. Never blocks the status
    // update itself.
    if (newStatus === 'completed') {
      fetch(`/api/jobs/${jobId}/sync-conversion`, { method: 'POST' }).catch(() => {})
    }

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function assignProvider() {
    if (!selectedProvider) return
    setLoading(true)
    const supabase = createClient()

    await supabase.from('jobs').update({
      provider_id: selectedProvider,
      status: currentStatus === 'pending' ? 'assigned' : currentStatus,
    }).eq('id', jobId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Provider assignment */}
      {providers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="">Assign provider...</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          {selectedProvider && selectedProvider !== currentProviderId && (
            <button onClick={assignProvider} disabled={loading}
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
              Assign
            </button>
          )}
        </div>
      )}

      {/* Status update */}
      {nextStatuses.length > 0 && (
        <div className="relative">
          <button onClick={() => setOpen(!open)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Update status
            <ChevronDown className="w-3 h-3" />
          </button>
          {open && (
            <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-44">
              {nextStatuses.map(status => (
                <button key={status} onClick={() => updateStatus(status)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  → {JOB_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
