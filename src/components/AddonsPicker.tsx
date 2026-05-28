'use client'

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
  const active = extras.filter(e => e.is_active)
  console.log('[XD] AddonsPicker active:', active.length, 'popular:', active.filter(e=>e.is_popular).length, 'other:', active.filter(e=>!e.is_popular).length)

  if (active.length === 0) return null

  const popularExtras = active.filter(e => e.is_popular).sort((a, b) => a.name.localeCompare(b.name))
  const otherExtras = active.filter(e => !e.is_popular).sort((a, b) => a.name.localeCompare(b.name))

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
          ? <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1 flex-shrink-0 ml-2 whitespace-nowrap">Custom</span>
          : <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">+${(extra.price / 100).toFixed(0)}</span>
        }
      </label>
    )
  }

  return (
    <div className="relative">
      <div
        className="max-h-[400px] overflow-y-auto pr-1"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {popularExtras.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Popular add-ons</h4>
            <div className="space-y-0.5">
              {popularExtras.map(renderRow)}
            </div>
          </div>
        )}
        {otherExtras.length > 0 && (
          <div className={popularExtras.length > 0 ? 'mt-5' : ''}>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">All add-ons</h4>
            <div className="space-y-0.5">
              {otherExtras.map(renderRow)}
            </div>
          </div>
        )}
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"
        aria-hidden="true"
      />
    </div>
  )
}
