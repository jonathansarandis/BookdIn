'use client'
// Attaches (or swaps to) the customer's already-saved card on this specific booking,
// so returning customers don't have to be contacted again for card details.
// Uses the same /attach-saved-card route as the new-booking form: it records the card
// and sets payment_status='card_on_file' without authorizing anything.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react'

interface Props {
  jobId: string
  paymentMethodId: string
  brand: string | null
  last4: string | null
  replacing?: boolean
}

export default function UseSavedCardButton({ jobId, paymentMethodId, brand, last4, replacing }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/attach-saved-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not attach card')
      setDone(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Saved card attached to this booking
      </p>
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-2 px-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
        {loading ? 'Attaching…' : `${replacing ? 'Switch to' : 'Use'} saved card · ${(brand || 'Card')} •••• ${last4 || ''}`}
      </button>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}
