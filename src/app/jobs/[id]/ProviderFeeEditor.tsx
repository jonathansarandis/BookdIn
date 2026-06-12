'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  jobId: string
  providerName: string | null
  initialFeeExtra: number | null  // cents; null = not set
  payoutCents: number             // computed total payout for display
}

export default function ProviderFeeEditor({
  jobId,
  providerName,
  initialFeeExtra,
  payoutCents,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [feeExtra, setFeeExtra] = useState<number | null>(initialFeeExtra)
  const [draft, setDraft] = useState(initialFeeExtra != null ? (initialFeeExtra / 100).toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post(provider_fee_extra: number | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/provider-fee-extra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_fee_extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setFeeExtra(provider_fee_extra)
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function save() {
    const val = parseFloat(draft)
    if (!Number.isFinite(val) || val < 0) {
      setError('Amount must be $0.00 or more')
      return
    }
    post(Math.round(val * 100))
  }

  function cancel() {
    setDraft(feeExtra != null ? (feeExtra / 100).toFixed(2) : '')
    setEditing(false)
    setError(null)
  }

  const label = providerName ? `${providerName} payout` : 'Provider payout'

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-xs">+$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="0.00"
              className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <span className="text-gray-400 text-xs">flat extra</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {feeExtra != null && (
            <button
              onClick={() => post(null)}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
            >
              Clear extra
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">{label}</span>
          <button
            onClick={() => { setDraft(feeExtra != null ? (feeExtra / 100).toFixed(2) : ''); setEditing(true) }}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Edit provider flat extra"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {feeExtra != null && (
            <button
              onClick={() => post(null)}
              disabled={saving}
              className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Clear flat extra"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="font-semibold text-gray-900">${(payoutCents / 100).toFixed(2)}</span>
      </div>
      {feeExtra != null && feeExtra > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>inc. ${(feeExtra / 100).toFixed(2)} flat extra</span>
        </div>
      )}
    </div>
  )
}
