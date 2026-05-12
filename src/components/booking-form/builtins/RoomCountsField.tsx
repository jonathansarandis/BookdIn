'use client'

import { useEffect } from 'react'
import { BuiltinFieldProps, RoomCountsValue, RoomPricing, Service, INPUT_CLASS, LABEL_CLASS } from './types'

interface Context {
  selectedService: Service | null
  roomPricing: RoomPricing[]
}

interface Props extends BuiltinFieldProps<RoomCountsValue, Context> {}

export default function RoomCountsField({ value, onChange, context, disabled }: Props) {
  const { selectedService, roomPricing } = context

  function getBedroomCounts(): number[] {
    const beds = roomPricing.filter(r => r.type === 'bedroom').map(r => r.count).sort((a, b) => a - b)
    return beds.length > 0 ? beds : [1, 2, 3, 4, 5]
  }

  function getBathroomCounts(): number[] {
    const baths = roomPricing.filter(r => r.type === 'bathroom').map(r => r.count).sort((a, b) => a - b)
    return baths.length > 0 ? baths : [1, 2, 3]
  }

  useEffect(() => {
    if (selectedService?.pricing_type !== 'room_based') return
    if (value.bedrooms == null || value.bathrooms == null) {
      const defaultBeds = getBedroomCounts()[0] ?? 1
      const defaultBaths = getBathroomCounts()[0] ?? 1
      onChange({
        bedrooms: value.bedrooms ?? defaultBeds,
        bathrooms: value.bathrooms ?? defaultBaths,
      })
    }
  }, [selectedService?.id])

  if (selectedService?.pricing_type !== 'room_based') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm text-gray-500">Pricing is flat for this service.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Property size</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Bedrooms</label>
          <select
            value={value.bedrooms ?? 1}
            onChange={e => onChange({ ...value, bedrooms: parseInt(e.target.value) })}
            className={INPUT_CLASS}
            disabled={disabled}
          >
            {getBedroomCounts().map(n => (
              <option key={n} value={n}>{n} bedroom{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Bathrooms</label>
          <select
            value={value.bathrooms ?? 1}
            onChange={e => onChange({ ...value, bathrooms: parseInt(e.target.value) })}
            className={INPUT_CLASS}
            disabled={disabled}
          >
            {getBathroomCounts().map(n => (
              <option key={n} value={n}>{n} bathroom{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
