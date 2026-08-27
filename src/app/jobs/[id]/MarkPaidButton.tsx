'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Banknote } from 'lucide-react'

interface Props {
  jobId: string
}

/**
 * For payments collected outside Stripe — cash handed to the cleaner, a
 * bank transfer, an invoice paid elsewhere, etc. Sets payment_status='paid'
 * directly; never touches Stripe or the saved card.
 */
export default function MarkPaidButton({ jobId }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'other'>('cash')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to mark as paid')
      setSuccess(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Marked as paid
      </p>
    )
  }

  if (expanded) {
    return (
      <div className="border border-gray-200 rounded-lg p-2.5 space-y-2">
        <p className="text-xs text-gray-500">How was this paid?</p>
        <select
          value={method}
          onChange={e => setMethod(e.target.value as any)}
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="other">Other</option>
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(false)}
            disabled={loading}
            className="flex-1 py-1.5 px-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex-1 py-1.5 px-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {loading ? 'Saving…' : 'Confirm paid'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setExpanded(true)}
      className="w-full py-2 px-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
      title="For cash, bank transfer, or other payments collected outside BookdIn"
    >
      <Banknote className="w-3.5 h-3.5" />
      Mark as paid manually
    </button>
  )
}
