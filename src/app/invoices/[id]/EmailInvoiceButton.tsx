'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Mail } from 'lucide-react'

interface Props {
  invoiceId: string
}

export default function EmailInvoiceButton({ invoiceId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send email')
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
        className="w-full py-2 px-4 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
        {loading ? 'Sending…' : 'Email to customer'}
      </button>
      {success && (
        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1 justify-center">
          <CheckCircle2 className="w-3.5 h-3.5" /> Invoice emailed
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5 text-center">{error}</p>}
    </div>
  )
}
