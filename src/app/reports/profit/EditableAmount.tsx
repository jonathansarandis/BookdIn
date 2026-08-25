'use client'
import { useState } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  label: string
  calculatedCents: number
  overrideCents: number | null // null = using the calculated value
  onSave: (cents: number | null) => Promise<void>
}

/**
 * Inline pencil-to-edit control for the two "auto-calculated" profit report
 * lines (Subcontractor pay, GST) — same click-to-edit pattern as the
 * per-job ProviderFeeEditor on the job detail page. The calculation is a
 * reasonable default, but doesn't capture job-level customisations (add-ons,
 * parking/fuel fees, one-off negotiated rates) or cash jobs with no GST
 * charged, so staff can override it per location/week. Clearing the override
 * reverts to the live-calculated value.
 */
export default function EditableAmount({ label, calculatedCents, overrideCents, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const isOverridden = overrideCents != null
  const effectiveCents = isOverridden ? overrideCents : calculatedCents
  const [draft, setDraft] = useState((effectiveCents / 100).toFixed(2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function commit(cents: number | null) {
    setSaving(true)
    setError(null)
    try {
      await onSave(cents)
      setEditing(false)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
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
    commit(Math.round(val * 100))
  }

  function cancel() {
    setDraft((effectiveCents / 100).toFixed(2))
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <div className="py-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">$</span>
            <input
              type="number" min="0" step="0.01"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-24 text-right text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 text-right mt-0.5">{error}</p>}
        <div className="flex items-center justify-end gap-2 mt-1">
          {isOverridden && (
            <button
              onClick={() => commit(null)}
              disabled={saving}
              className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
            >
              Reset to calculated ({formatCurrency(calculatedCents)})
            </button>
          )}
          <button
            onClick={cancel}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-0.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-0.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-between items-center text-sm py-0.5">
      <span className="text-gray-500 flex items-center gap-1.5">
        {label}
        {isOverridden && (
          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">edited</span>
        )}
        <button
          onClick={() => { setDraft((effectiveCents / 100).toFixed(2)); setEditing(true) }}
          className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title={`Edit ${label.toLowerCase()}`}
        >
          <Pencil className="w-3 h-3" />
        </button>
      </span>
      <span className="text-gray-700">{formatCurrency(effectiveCents)}</span>
    </div>
  )
}
