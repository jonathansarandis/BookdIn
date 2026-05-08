'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  label?: string
}

export default function CancelCardButton({ jobId, label = 'Cancel saved card' }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel-card`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-2 px-3 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-2 bg-red-50 rounded-xl p-3">
      <p className="text-xs text-red-700">
        {label === 'Cancel pre-authorization'
          ? 'This will release the pre-authorized hold and remove the saved card from this job.'
          : 'This will remove the saved card from this job. The customer will need to re-enter their card.'}
      </p>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setConfirming(false); setError(null) }}
          disabled={loading}
          className="flex-1 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Keep card
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Cancelling…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
