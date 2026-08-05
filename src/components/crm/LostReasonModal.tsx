'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

export const LOST_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'found_cheaper', label: 'Found cheaper option' },
  { value: 'wrong_area', label: 'Wrong area' },
  { value: 'no_response', label: 'No response' },
  { value: 'other', label: 'Other' },
]

interface Props {
  contactName: string
  onCancel: () => void
  onConfirm: (reason: string, notes: string) => void | Promise<void>
}

export default function LostReasonModal({ contactName, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!reason) return
    setSaving(true)
    await onConfirm(reason, notes)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Mark {contactName} as Lost</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason *</label>
          <div className="space-y-1.5">
            {LOST_REASONS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                  reason === r.value
                    ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {reason === 'other' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Details</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="What happened?"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Mark as Lost
          </button>
        </div>
      </div>
    </div>
  )
}
