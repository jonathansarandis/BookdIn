'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

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

const cls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

export default function AddressAutocomplete({ value, onChange, stateOptions }: Props) {
  const searchRef = useRef<HTMLInputElement>(null)
  const line1Ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const [manual, setManual] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      v: 'weekly',
    })

    importLibrary('places').then(({ Autocomplete }) => {
      if (!searchRef.current) return

      const ac = new Autocomplete(searchRef.current, {
        componentRestrictions: { country: 'au' },
        types: ['address'],
        fields: ['address_components'],
      })

      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.address_components) return

        const get = (type: string, form: 'long_name' | 'short_name' = 'long_name') =>
          place.address_components!.find(c => c.types.includes(type))?.[form] ?? ''

        const subpremise = get('subpremise')
        const streetNumber = get('street_number')
        const route = get('route')

        onChangeRef.current({
          line1: subpremise
            ? `${subpremise}/${streetNumber} ${route}`
            : `${streetNumber} ${route}`.trim(),
          city: get('locality') || get('sublocality_level_1'),
          state: get('administrative_area_level_1', 'short_name'),
          postcode: get('postal_code'),
        })

        if (searchRef.current) searchRef.current.value = ''
      })
    })
  }, [])

  const handleManual = () => {
    setManual(true)
    setTimeout(() => line1Ref.current?.focus(), 0)
  }

  return (
    <div className="space-y-3">
      <div className={manual ? 'opacity-40 pointer-events-none select-none' : ''}>
        <label className={lbl}>Search address</label>
        <input
          ref={searchRef}
          type="text"
          placeholder="Start typing an address..."
          className={cls}
          autoComplete="off"
        />
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

      <div>
        <label className={lbl}>Street address *</label>
        <input
          ref={line1Ref}
          required
          value={value.line1}
          onChange={e => onChange({ ...value, line1: e.target.value })}
          placeholder="123 Main Street"
          className={cls}
        />
      </div>

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
