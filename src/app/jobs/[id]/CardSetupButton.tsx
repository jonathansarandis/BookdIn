'use client'
import { useState } from 'react'
import { Link2 } from 'lucide-react'

export default function CardSetupButton({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const url = `${window.location.origin}/api/bookings/${jobId}/card-setup`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <button
        onClick={copyLink}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Link2 className="w-3.5 h-3.5" />
        Send card setup link
      </button>
      {copied && (
        <p className="text-xs text-green-600 text-center mt-1.5">
          ✓ Link copied — paste into SMS or email
        </p>
      )}
    </div>
  )
}
