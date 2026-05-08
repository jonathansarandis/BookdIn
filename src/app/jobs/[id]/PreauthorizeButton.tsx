'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  jobId: string
  label?: string
}

export default function PreauthorizeButton({ jobId, label = 'Pre-authorize now' }: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/preauthorize`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pre-authorization failed')
      setSuccess(true)
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Pre-authorized successfully
      </p>
    )
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {loading ? 'Processing…' : label}
      </button>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}
