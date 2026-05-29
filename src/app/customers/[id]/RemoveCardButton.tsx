'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RemoveCardButton({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    if (!confirm('Remove this card on file?')) return
    setLoading(true)
    await fetch(`/api/customers/${customerId}/payment-method`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
    >
      {loading ? 'Removing…' : 'Remove card'}
    </button>
  )
}
