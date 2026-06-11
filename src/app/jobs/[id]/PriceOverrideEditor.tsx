'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  initialOverride: number | null  // cents
  derivedTotal: number             // cents — job.total_price ?? job.price ?? 0
  showBorder?: boolean             // add top border when tax breakdown is shown above
}

export default function PriceOverrideEditor({ jobId, initialOverride, derivedTotal, showBorder = false }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [override, setOverride] = useState<number | null>(initialOverride)
  const [draft, setDraft] = useState(initialOverride != null ? (initialOverride / 100).toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayCents = override ?? derivedTotal

  async function post(price_override: number | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/price-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_override }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setOverride(price_override)
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function save() {
    const cents = Math.round(parseFloat(draft) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Amount must be greater than $0')
      return
    }
    post(cents)
  }

  function cancel() {
    setDraft(override != null ? (override / 100).toFixed(2) : '')
    setEditing(false)
    setError(null)
  }

  const borderClass = showBorder ? 'border-t border-gray-100 pt-2' : ''

  if (editing) {
    return (
      <div className={`${borderClass} space-y-2`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={(derivedTotal / 100).toFixed(2)}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <span className="text-gray-400 text-xs">AUD</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-right">Derived: ${(derivedTotal / 100).toFixed(2)}</p>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {override != null && (
            <button
              onClick={() => post(null)}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
            >
              Clear override
            </button>
          )}
          <button
            onClick={cancel}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${borderClass} space-y-1`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">{override != null ? 'Total (manual)' : 'Total'}</span>
          <button
            onClick={() => { setDraft((displayCents / 100).toFixed(2)); setEditing(true) }}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Set manual price"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {override != null && (
            <button
              onClick={() => post(null)}
              disabled={saving}
              className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Clear manual price"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="font-semibold text-gray-900">${(displayCents / 100).toFixed(2)} AUD</span>
      </div>
      {override != null && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Derived</span>
          <span>${(derivedTotal / 100).toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}
