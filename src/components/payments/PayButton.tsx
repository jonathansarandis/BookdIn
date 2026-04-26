'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'

interface Props {
  jobId?: string
  invoiceId?: string
  amount: number
  label?: string
}

export default function PayButton({ jobId, invoiceId, amount, label }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, invoiceId }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      // Redirect to Stripe checkout
      window.location.href = data.url
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {loading ? 'Redirecting...' : label || `Collect payment · $${(amount / 100).toFixed(2)}`}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
