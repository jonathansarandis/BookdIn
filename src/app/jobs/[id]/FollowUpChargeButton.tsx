'use client'
// TODO: schema.sql is out of sync with prod for jobs.parent_job_id and jobs.location_id — sync post-launch
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  jobId: string
}

export default function FollowUpChargeButton({ jobId }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function parseCents(val: string): number | null {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) return null
    return Math.round(n * 100)
  }

  function handleClose() {
    setIsOpen(false)
    setError(null)
    setAmount('')
    setNotes('')
  }

  async function handleSubmit() {
    const amount_cents = parseCents(amount)
    if (!amount_cents) {
      setError('Enter a valid amount greater than $0.00')
      return
    }
    if (!notes.trim()) {
      setError('Notes are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/follow-up-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Request failed')
        return
      }
      if (data.success) {
        router.push(`/jobs/${data.child_job_id}`)
      } else {
        setError(data.error || 'Authorization failed — check child job for details')
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Additional charge
      </button>
    )
  }

  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Amount</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full pl-6 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Notes</label>
        <textarea
          rows={3}
          placeholder="Reason for charge — late cancel fee, additional service, etc."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          required
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleClose}
          disabled={loading}
          className="flex-1 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          className="flex-1 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Authorizing…' : 'Authorize charge'}
        </button>
      </div>
    </div>
  )
}
