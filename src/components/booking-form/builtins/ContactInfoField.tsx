'use client'

import { BuiltinFieldProps, ContactInfoValue, INPUT_CLASS, LABEL_CLASS } from './types'

interface Props extends BuiltinFieldProps<ContactInfoValue, Record<string, never>> {}

export default function ContactInfoField({ value, onChange, disabled }: Props) {
  function update(field: keyof ContactInfoValue, v: string) {
    onChange({ ...value, [field]: v })
  }

  // Update first/last and keep full_name derived from both, so downstream
  // code and the customers table (which store full_name) keep working.
  function updateName(part: 'first_name' | 'last_name', v: string) {
    const next = { ...value, [part]: v }
    next.full_name = `${next.first_name || ''} ${next.last_name || ''}`.trim()
    onChange(next)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Your details</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>First name<span className="text-red-500 ml-1">*</span></label>
          <input
            required
            value={value.first_name || ''}
            onChange={e => updateName('first_name', e.target.value)}
            placeholder="Jane"
            className={INPUT_CLASS}
            disabled={disabled}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Last name<span className="text-red-500 ml-1">*</span></label>
          <input
            required
            value={value.last_name || ''}
            onChange={e => updateName('last_name', e.target.value)}
            placeholder="Smith"
            className={INPUT_CLASS}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Email<span className="text-red-500 ml-1">*</span></label>
          <input
            required
            type="email"
            value={value.email}
            onChange={e => update('email', e.target.value)}
            placeholder="jane@email.com"
            className={INPUT_CLASS}
            disabled={disabled}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Phone<span className="text-red-500 ml-1">*</span></label>
          <input
            required
            value={value.phone}
            onChange={e => update('phone', e.target.value)}
            placeholder="04xx xxx xxx"
            className={INPUT_CLASS}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
