'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  jobId: string
  chargedCents: number  // amount that was charged (max refundable)
}

export default function RefundButton({ jobId, chargedCents }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState((chargedCents / 100).toFixed(2))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (success) {
    return (
      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Refund issued
      </p>
    )
  }

  async function handleRefund() {
    setLoading(true)
    setError(null)
    const amountCents = partial ? Math.round(parseFloat(amount) * 100) : undefined
    try {
      const res = await fetch(`/api/jobs/${jobId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amountCents !== undefined ? { amountCents } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refund failed')
      setSuccess(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2 px-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
      >
        Refund payment
      </button>
    )
  }

  return (
    <div className="space-y-2.5 bg-gray-50 rounded-xl p-3">
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} className="rounded" />
        Refund a partial amount
      </label>
      {partial && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={(chargedCents / 100).toFixed(2)}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <span className="text-xs text-gray-400">of ${(chargedCents / 100).toFixed(2)}</span>
        </div>
      )}
      <p className="text-xs text-gray-500">This refunds the customer via Stripe and cannot be undone.</p>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="flex-1 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleRefund}
          disabled={loading}
          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Refunding…' : `Refund · $${partial ? amount : (chargedCents / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
