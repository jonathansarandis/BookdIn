'use client'
import { useState } from 'react'

type Extra = {
  id: string
  name: string
  description?: string | null
  price: number
  is_active: boolean
  is_popular: boolean
  is_quote_only: boolean
}

type Props = {
  extras: Extra[]
  selected: string[]
  onChange: (id: string) => void
  brandColor?: string
}

export default function AddonsPicker({ extras, selected, onChange, brandColor }: Props) {
  const [showAll, setShowAll] = useState(false)

  const active = extras.filter(e => e.is_active)
  const popular = active.filter(e => e.is_popular)
  const rest = active.filter(e => !e.is_popular)

  if (active.length === 0) return null

  // No popular items flagged → show all by default (graceful fallback for businesses without is_popular set)
  const visible = showAll || popular.length === 0 ? active : popular
  const hasToggle = popular.length > 0 && rest.length > 0

  function renderRow(extra: Extra) {
    return (
      <label key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={selected.includes(extra.id)}
            onChange={() => onChange(extra.id)}
            className={`w-4 h-4 cursor-pointer flex-shrink-0${!brandColor ? ' accent-brand-500' : ''}`}
            style={brandColor ? { accentColor: brandColor } : undefined}
          />
          <div className="min-w-0">
            <span className="text-sm text-gray-700">{extra.name}</span>
            {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
          </div>
        </div>
        {extra.is_quote_only
          ? <span className="text-sm font-medium text-gray-500 flex-shrink-0 ml-2">Quote on arrival</span>
          : <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">+${(extra.price / 100).toFixed(0)}</span>
        }
      </label>
    )
  }

  return (
    <div>
      <div className="space-y-0.5">{visible.map(renderRow)}</div>
      {hasToggle && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className={`mt-3 block mx-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-90${!brandColor ? ' bg-brand-500' : ''}`}
          style={brandColor ? { backgroundColor: brandColor } : undefined}
        >
          {showAll ? 'Show fewer' : `Show all add-ons (${rest.length} more)`}
        </button>
      )}
    </div>
  )
}
