'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { Search } from 'lucide-react'

interface AddressValue {
  line1: string
  city: string
  state: string
  postcode: string
}

interface Props {
  value: AddressValue
  onChange: (v: AddressValue) => void
  stateOptions?: string[]
}

const cls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

export default function AddressAutocomplete({ value, onChange, stateOptions }: Props) {
  const line1Ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const manualRef = useRef(false)
  const [manual, setManual] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      v: 'weekly',
    })

    importLibrary('places').then(({ Autocomplete }) => {
      if (!line1Ref.current) return

      const ac = new Autocomplete(line1Ref.current, {
        componentRestrictions: { country: 'au' },
        types: ['address'],
        fields: ['address_components', 'geometry', 'name', 'formatted_address'],
      })

      ac.addListener('place_changed', () => {
        if (manualRef.current) return

        const place = ac.getPlace()
        if (!place.address_components) {
          console.warn('[AddressAutocomplete] place_changed: address_components missing', place)
          return
        }

        const get = (type: string, form: 'long_name' | 'short_name' = 'long_name') =>
          place.address_components!.find(c => c.types.includes(type))?.[form] ?? ''

        const subpremise = get('subpremise')
        const streetNumber = get('street_number')
        const route = get('route')
        const line1 = subpremise
          ? `${subpremise}/${streetNumber} ${route}`
          : `${streetNumber} ${route}`.trim()

        // Anti-flicker: overwrite DOM value synchronously before React re-renders
        // so Google's full formatted_address never appears in the street field.
        if (line1Ref.current) line1Ref.current.value = line1

        onChangeRef.current({
          line1,
          city: get('locality') || get('sublocality_level_1'),
          state: get('administrative_area_level_1', 'short_name'),
          postcode: get('postal_code'),
        })
      })
    })
  }, [])

  const handleManual = () => {
    manualRef.current = true
    setManual(true)
    setTimeout(() => line1Ref.current?.focus(), 0)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={lbl}>Street address *</label>
        <div className="relative">
          <input
            ref={line1Ref}
            required
            value={value.line1}
            onChange={e => onChange({ ...value, line1: e.target.value })}
            placeholder={manual ? '123 Main Street' : 'Start typing an address...'}
            className={cls + (manual ? '' : ' pr-8')}
            autoComplete="off"
          />
          {!manual && (
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          )}
        </div>
      </div>

      {!manual && (
        <button
          type="button"
          onClick={handleManual}
          className="text-xs text-gray-400 hover:text-gray-500 underline underline-offset-2"
        >
          Enter address manually
        </button>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className={lbl}>Suburb *</label>
          <input
            required
            value={value.city}
            onChange={e => onChange({ ...value, city: e.target.value })}
            placeholder="Melbourne"
            className={cls}
          />
        </div>
        <div>
          <label className={lbl}>State *</label>
          {stateOptions ? (
            <select
              required
              value={value.state}
              onChange={e => onChange({ ...value, state: e.target.value })}
              className={cls}
            >
              <option value="">State</option>
              {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              required
              value={value.state}
              onChange={e => onChange({ ...value, state: e.target.value })}
              placeholder="VIC"
              className={cls}
            />
          )}
        </div>
        <div>
          <label className={lbl}>Postcode *</label>
          <input
            required
            value={value.postcode}
            onChange={e => onChange({ ...value, postcode: e.target.value })}
            placeholder="3000"
            className={cls}
          />
        </div>
      </div>
    </div>
  )
}
