'use client'

import AddonsPicker from '@/components/AddonsPicker'
import { BuiltinFieldProps, ExtrasPickerValue, Service, Business } from './types'

interface Context {
  selectedService: Service | null
  business: Business | null
}

interface Props extends BuiltinFieldProps<ExtrasPickerValue, Context> {}

export default function ExtrasPickerField({ value, onChange, context, disabled }: Props) {
  console.log('[XD2] ExtrasPickerField mounted')
  const { selectedService, business } = context
  const brand = business?.brand_color || '#1A6B4A'

  const extras = selectedService?.service_extras ?? []
  console.log('[XD2] ExtrasPickerField extras:', extras.length, 'active:', extras.filter((e:any)=>e.is_active).length)
  console.log('[XD2] before is_active guard, some active:', extras.some((e:any)=>e.is_active))
  if (!extras.some(e => e.is_active)) return null

  function handleToggle(id: string) {
    if (disabled) return
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">Add-ons</h3>
      <AddonsPicker
        extras={extras}
        selected={value}
        onChange={handleToggle}
        brandColor={brand}
      />
    </div>
  )
}
