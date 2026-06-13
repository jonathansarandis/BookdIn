'use client'

type Extra = {
  id: string
  name: string
  description?: string | null
  price: number
  is_active: boolean
  is_popular: boolean
  is_quote_only: boolean
  is_quantifiable: boolean
}

type Props = {
  extras: Extra[]
  selected: Record<string, number>            // id → quantity; absent key = unselected
  onChange: (id: string, quantity: number) => void  // quantity=0 deselects
  brandColor?: string
  showPrice?: boolean
}

export default function AddonsPicker({ extras, selected, onChange, brandColor, showPrice = true }: Props) {
  const active = extras.filter(e => e.is_active)

  if (active.length === 0) return null

  const popularExtras = active.filter(e => e.is_popular).sort((a, b) => a.name.localeCompare(b.name))
  const otherExtras = active.filter(e => !e.is_popular).sort((a, b) => a.name.localeCompare(b.name))

  function renderRow(extra: Extra) {
    const qty = selected[extra.id] ?? 0
    const isSelected = qty > 0
    const showStepper = extra.is_quantifiable && !extra.is_quote_only

    if (showStepper) {
      return (
        <div key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700">{extra.name}</span>
            {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {showPrice && isSelected && (
              <span className="text-sm font-medium text-gray-900">
                +${((extra.price * qty) / 100).toFixed(0)}
              </span>
            )}
            {!isSelected ? (
              <button
                type="button"
                onClick={() => onChange(extra.id, 1)}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors${!brandColor ? ' border-brand-500 text-brand-600 hover:bg-brand-50' : ''}`}
                style={brandColor ? { borderColor: brandColor, color: brandColor } : undefined}
              >
                Add
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(extra.id, qty - 1)}
                  className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium transition-colors"
                >−</button>
                <span className="w-5 text-center text-sm font-medium text-gray-900">{qty}</span>
                <button
                  type="button"
                  onClick={() => onChange(extra.id, qty + 1)}
                  className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium transition-colors"
                >+</button>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <label key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onChange(extra.id, isSelected ? 0 : 1)}
            className={`w-4 h-4 cursor-pointer flex-shrink-0${!brandColor ? ' accent-brand-500' : ''}`}
            style={brandColor ? { accentColor: brandColor } : undefined}
          />
          <div className="min-w-0">
            <span className="text-sm text-gray-700">{extra.name}</span>
            {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
          </div>
        </div>
        {showPrice && (extra.is_quote_only
          ? <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1 flex-shrink-0 ml-2 whitespace-nowrap">Custom</span>
          : <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">+${(extra.price / 100).toFixed(0)}</span>
        )}
      </label>
    )
  }

  return (
    <div className="relative">
      <div
        className="max-h-[400px] overflow-y-auto pr-1 addons-scroll"
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
