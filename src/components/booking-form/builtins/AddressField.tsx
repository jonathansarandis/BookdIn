'use client'

import AddressAutocomplete from '@/components/AddressAutocomplete'
import { BuiltinFieldProps, AddressValue } from './types'

interface Props extends BuiltinFieldProps<AddressValue, Record<string, never>> {}

export default function AddressField({ value, onChange, disabled }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Service address<span className="text-red-500 ml-1">*</span></h3>
      <AddressAutocomplete
        value={value}
        onChange={onChange}
        stateOptions={['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']}
      />
    </div>
  )
}
