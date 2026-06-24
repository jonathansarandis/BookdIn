'use client'
import { useState } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  valueCents: number | null   // committed override, or null when none
  derivedCents: number        // system-computed total to fall back on
  onCommit: (cents: number | null) => void | Promise<void>
  disabled?: boolean
}

export default function InlinePriceEditor({ valueCents, derivedCents, onCommit, disabled = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(valueCents != null ? (valueCents / 100).toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayCents = valueCents ?? derivedCents

  async function commit(cents: number | null) {
    setSaving(true)
    setError(null)
    try {
      await onCommit(cents)
      setEditing(false)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
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
    commit(cents)
  }

  function cancel() {
    setDraft(valueCents != null ? (valueCents / 100).toFixed(2) : '')
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <div className="space-y-2">
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
              placeholder={(derivedCents / 100).toFixed(2)}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <span className="text-gray-400 text-xs">AUD</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-right">Derived: ${(derivedCents / 100).toFixed(2)}</p>
        {error && <p className="text-xs text-red-600 text-right">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {valueCents != null && (
            <button
              onClick={() => commit(null)}
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">{valueCents != null ? 'Total (manual)' : 'Total'}</span>
          <button
            onClick={() => { setDraft((displayCents / 100).toFixed(2)); setEditing(true) }}
            disabled={disabled}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Set manual price"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {valueCents != null && (
            <button
              onClick={() => commit(null)}
              disabled={disabled || saving}
              className="text-xs text-gray-400 hover:text-red-500 underline disabled:opacity-50"
              title="Reset to derived total"
            >
              Reset
            </button>
          )}
        </div>
        <span className="font-semibold text-gray-900">${(displayCents / 100).toFixed(2)} AUD</span>
      </div>
      {valueCents != null && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Derived</span>
          <span>${(derivedCents / 100).toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}
