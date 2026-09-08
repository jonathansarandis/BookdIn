'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarX } from 'lucide-react'
import ConfirmDeleteModal from '@/components/crm/ConfirmDeleteModal'

interface Props {
  jobId: string
  customerName?: string | null
}

// Cancels this booking plus every future booking in the same recurring series,
// and removes the schedule itself so nothing regenerates it tomorrow. Only
// rendered for jobs whose frequency is weekly/fortnightly/monthly (see
// jobs/[id]/page.tsx) — works whether or not the job has a linked
// recurring_schedule_id, since the API route falls back to matching by
// customer + service for the orphaned-recurring-job case.
export default function CancelSeriesButton({ jobId, customerName }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(notify: boolean) {
    setError(null)
    const res = await fetch(`/api/jobs/${jobId}/cancel-series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify }),
    })
    const data = await res.json()
    setShowModal(false)
    if (!res.ok) {
      setError(data.error || 'Failed to cancel the series. Please try again.')
      return
    }
    router.push('/recurring')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Cancel this booking and every future booking in the same recurring series"
        className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
      >
        <CalendarX className="w-3.5 h-3.5" />
        Cancel series
      </button>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {showModal && (
        <ConfirmDeleteModal
          title="Cancel entire recurring series?"
          message={`This cancels this booking and every future booking for ${customerName || 'this customer'} in the same recurring series, and removes the schedule so it won't generate any more. Past and completed bookings are not affected. This can't be undone.`}
          confirmLabel="Cancel series"
          checkboxLabel="Send cancellation email to customer"
          checkboxDefault={false}
          onCancel={() => setShowModal(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
