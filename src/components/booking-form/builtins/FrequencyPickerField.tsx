'use client'

import { BuiltinFieldProps, FrequencyPickerValue, FrequencyDiscount, Business, FREQUENCIES } from './types'

interface Context {
  frequencyDiscounts: FrequencyDiscount[]
  business: Business | null
}

interface Props extends BuiltinFieldProps<FrequencyPickerValue, Context> {}

export default function FrequencyPickerField({ value, onChange, context, disabled }: Props) {
  const { frequencyDiscounts, business } = context
  const brand = business?.brand_color || '#1A6B4A'
  const brandTint = `${brand}14`

  function getDiscount(freq: string): number {
    if (freq === 'one_time') return 0
    const row = frequencyDiscounts.find(d => d.frequency === freq)
    if (!row?.is_enabled) return 0
    return row.discount_percent ?? 0
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Frequency</h3>
      <div className="grid grid-cols-2 gap-2">
        {FREQUENCIES.map(f => {
          const disc = getDiscount(f.value)
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => { if (!disabled) onChange(f.value) }}
              disabled={disabled}
              className={`p-3 rounded-lg border text-left transition-colors ${
                value === f.value ? '' : 'border-gray-200 hover:border-gray-300'
              }`}
              style={value === f.value ? { borderColor: brand, backgroundColor: brandTint } : undefined}
            >
              <div
                className={`text-xs font-medium ${value === f.value ? '' : 'text-gray-900'}`}
                style={value === f.value ? { color: brand } : undefined}
              >
                {f.label}
              </div>
              {disc > 0 && (
                <div className="text-[10px] text-green-600 mt-0.5">{disc}% discount</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
