'use client'

import { BuiltinFieldProps, Service, Business, ServicePickerValue } from './types'

interface Context {
  services: Service[]
  business: Business | null
}

interface Props extends BuiltinFieldProps<ServicePickerValue, Context> {}

export default function ServicePickerField({ value, onChange, context, disabled }: Props) {
  const { services, business } = context
  const brand = business?.brand_color || '#1A6B4A'
  const brandTint = `${brand}14`

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Select a service<span className="text-red-500 ml-1">*</span></h3>
      <div className="space-y-2">
        {services.map(s => (
          <label
            key={s.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              disabled ? 'cursor-default' : 'cursor-pointer'
            } ${value === s.id ? '' : 'border-gray-200 hover:border-gray-300'}`}
            style={value === s.id ? { borderColor: brand, backgroundColor: brandTint } : undefined}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={value === s.id}
                onChange={() => { if (!disabled) onChange(s.id) }}
                className="sr-only"
                disabled={disabled}
              />
              <div
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ borderColor: value === s.id ? brand : '#d1d5db' }}
              >
                {value === s.id && (
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brand }} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
              </div>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 ml-2">
              <span className="text-xs text-gray-500 leading-tight">from</span>
              <span className="text-sm font-semibold text-gray-900 leading-tight whitespace-nowrap">
                ${(s.base_price / 100).toFixed(0)}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
