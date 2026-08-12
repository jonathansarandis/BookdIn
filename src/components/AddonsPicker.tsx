'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

  const active = extras.filter(e => e.is_active)
  const popularExtras = active.filter(e => e.is_popular).sort((a, b) => a.name.localeCompare(b.name))
  const otherExtras = active.filter(e => !e.is_popular).sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function checkOverflow() {
      setHasOverflow(el!.scrollHeight > el!.clientHeight + 1)
    }
    function checkAtBottom() {
      const gapToBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight
      setAtBottom(gapToBottom < 4)
    }

    checkOverflow()
    checkAtBottom()

    el.addEventListener('scroll', checkAtBottom)
    window.addEventListener('resize', checkOverflow)
    return () => {
      el.removeEventListener('scroll', checkAtBottom)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [popularExtras.length, otherExtras.length])

  if (active.length === 0) return null

  const showScrollHint = hasOverflow && !atBottom

  function renderRow(extra: Extra) {
    const qty = selected[extra.id] ?? 0
    const isSelected = qty > 0
    const showStepper = extra.is_quantifiable && !extra.is_quote_only

    if (showStepper) {
      return (
        <div key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50">
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
          {isSelected ? (
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {showPrice && (
                <span className="text-sm font-medium text-gray-900">
                  +${((extra.price * qty) / 100).toFixed(0)}
                </span>
              )}
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
            </div>
          ) : (
            showPrice && <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">+${(extra.price / 100).toFixed(0)}</span>
          )}
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
    <div>
      <div className="addons-fade-container" data-scroll-end={showScrollHint ? 'false' : 'true'}>
        <div
          ref={scrollRef}
          className="max-h-[400px] overflow-y-auto pr-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
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
      </div>
      {showScrollHint && (
        <div className="flex flex-col items-center gap-0.5 pt-1.5" aria-hidden="true">
          <ChevronDown className="w-4 h-4 text-gray-400 addons-scroll-chevron" />
          <span className="text-xs text-gray-400">Scroll to see more extras</span>
        </div>
      )}
    </div>
  )
}
