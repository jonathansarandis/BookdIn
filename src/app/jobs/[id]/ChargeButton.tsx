'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  jobId: string
  totalPrice: number  // cents
}

export default function ChargeButton({ jobId, totalPrice }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState((totalPrice / 100).toFixed(2))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (success) {
    return (
      <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Payment captured successfully
      </p>
    )
  }

  async function handleCapture() {
    setLoading(true)
    setError(null)
    const amountCents = partial ? Math.round(parseFloat(amount) * 100) : undefined
    try {
      const res = await fetch(`/api/jobs/${jobId}/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amountCents !== undefined ? { amountToCapture: amountCents } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Capture failed')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2 px-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Capture payment · ${(totalPrice / 100).toFixed(2)}
      </button>
    )
  }

  return (
    <div className="space-y-2.5 bg-gray-50 rounded-xl p-3">
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={partial}
          onChange={e => setPartial(e.target.checked)}
          className="rounded"
        />
        Charge a different amount
      </label>
      {partial && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="flex-1 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleCapture}
          disabled={loading}
          className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Processing…' : `Confirm · $${partial ? amount : (totalPrice / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
