'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ConfirmDeleteModal from '@/components/crm/ConfirmDeleteModal'

interface Props {
  jobId: string
  customerName?: string | null
  paymentStatus?: string | null
}

export default function DeleteBookingButton({ jobId, customerName, paymentStatus }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    const supabase = createClient()

    // Clean up rows that don't cascade automatically before removing the job itself.
    await supabase.from('messages').delete().eq('job_id', jobId)
    await supabase.from('job_extras').delete().eq('job_id', jobId)
    // Additional-charge child jobs (see parent_job_id) belong entirely to this booking.
    await supabase.from('jobs').delete().eq('parent_job_id', jobId)
    // Detach any invoice rather than deleting it — invoices are financial records.
    await supabase.from('invoices').update({ job_id: null }).eq('job_id', jobId)

    const { error: err } = await supabase.from('jobs').delete().eq('id', jobId)

    if (err) {
      setError(err.message || 'Failed to delete booking. Please try again.')
      setShowModal(false)
      return
    }

    router.push('/jobs')
    router.refresh()
  }

  const isPaid = paymentStatus === 'paid'

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Delete booking"
        className="px-3 py-1.5 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>

      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {showModal && (
        <ConfirmDeleteModal
          title="Delete booking?"
          message={
            isPaid
              ? `This permanently deletes ${customerName || 'this'} booking, including notes, messages, and add-ons. This booking has a payment on record — deleting it will not issue a refund. This cannot be undone.`
              : `This permanently deletes ${customerName || 'this'} booking, including notes, messages, and add-ons. This cannot be undone.`
          }
          onCancel={() => setShowModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
