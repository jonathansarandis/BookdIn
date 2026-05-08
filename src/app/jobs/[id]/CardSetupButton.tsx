'use client'
import { useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'

export default function CardSetupButton({ jobId }: { jobId: string }) {
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateLink() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/setup-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate link')
      setLink(data.url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!link) {
    return (
      <div>
        <button
          onClick={generateLink}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Link2 className="w-3.5 h-3.5" />
          {loading ? 'Generating...' : 'Generate secure card link'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-600">Secure card link (valid 14 days):</div>
      <div className="flex items-stretch gap-1.5">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
        />
        <button
          onClick={copyToClipboard}
          className="px-2 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
        </button>
      </div>
      <p className="text-xs text-gray-500">Send this link to the customer to collect their card. They will not need to log in.</p>
    </div>
  )
}
