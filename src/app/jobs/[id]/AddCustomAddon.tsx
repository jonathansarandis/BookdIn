'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  jobId: string
}

export default function AddCustomAddon({ jobId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setIsOpen(false)
    setName('')
    setPrice('')
    setError(null)
  }

  async function handleSubmit() {
    const priceCents = Math.round(parseFloat(price) * 100)
    if (!name.trim()) { setError('Name is required'); return }
    if (isNaN(priceCents) || priceCents <= 0) { setError('Enter a valid amount greater than $0.00'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), price_cents: priceCents }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Request failed'); return }
      // TODO: replace with router.refresh() for soft refresh post-launch
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-2 px-3 border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 text-sm rounded-lg transition-colors"
      >
        + Add custom item
      </button>
    )
  }

  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Item name</label>
        <input
          type="text"
          placeholder="e.g. Oven clean, extra bedroom"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Price</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full pl-6 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleClose}
          disabled={loading}
          className="flex-1 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !price}
          className="flex-1 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </div>
  )
}
