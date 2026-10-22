'use client'
// Single-line address field with Google Places suggestions (Australia). Picking a suggestion
// fills the formatted address; staff can also just type any text (e.g. for old customers).
import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}

export default function BillingAddressInput({ value, onChange, className, placeholder }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!, v: 'weekly' })
    importLibrary('places').then(({ Autocomplete }) => {
      if (!ref.current) return
      const ac = new Autocomplete(ref.current, {
        componentRestrictions: { country: 'au' },
        types: ['address'],
        fields: ['formatted_address', 'address_components'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const text = (place.formatted_address || '').replace(/,\s*Australia$/i, '')
        if (text) {
          if (ref.current) ref.current.value = text
          onChangeRef.current(text)
        }
      })
    }).catch(() => { /* autocomplete is optional — typing still works */ })
  }, [])

  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Start typing an address…'}
      autoComplete="off"
      className={className}
    />
  )
}
