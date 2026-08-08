'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Mail } from 'lucide-react'

interface Props {
  jobId: string
}

export default function ResendConfirmationButton({ jobId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/bookings/${jobId}/send-confirmation`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data?.success === false) throw new Error(data.error || 'Failed to send confirmation email')
      setSuccess(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
        {loading ? 'Sending…' : 'Resend confirmation email'}
      </button>
      {success && (
        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmation email sent with the current price
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}
