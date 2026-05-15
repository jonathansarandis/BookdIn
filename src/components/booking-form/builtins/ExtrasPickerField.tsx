'use client'

import AddonsPicker from '@/components/AddonsPicker'
import { BuiltinFieldProps, ExtrasPickerValue, Service, Business } from './types'

interface Context {
  selectedService: Service | null
  business: Business | null
}

interface Props extends BuiltinFieldProps<ExtrasPickerValue, Context> {}

export default function ExtrasPickerField({ value, onChange, context, disabled }: Props) {
  const { selectedService, business } = context
  const brand = business?.brand_color || '#1A6B4A'

  const extras = selectedService?.service_extras ?? []
  // DIAGNOSTIC — remove before shipping
  console.log('[EPF] selectedService id:', selectedService?.id, 'name:', selectedService?.name)
  console.log('[EPF] extras received:', extras.map((e: any) => ({ id: e.id, name: e.name, price: e.price })))
  if (!extras.some(e => e.is_active)) return null

  function handleToggle(id: string) {
    if (disabled) return
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular add-ons</h3>
      <AddonsPicker
        extras={extras}
        selected={value}
        onChange={handleToggle}
        brandColor={brand}
      />
    </div>
  )
}
