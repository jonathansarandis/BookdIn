'use client'

import { BuiltinFieldProps, ContactInfoValue, INPUT_CLASS, LABEL_CLASS } from './types'

interface Props extends BuiltinFieldProps<ContactInfoValue, Record<string, never>> {}

export default function ContactInfoField({ value, onChange, disabled }: Props) {
  function update(field: keyof ContactInfoValue, v: string) {
    onChange({ ...value, [field]: v })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Your details</h3>
      <div>
        <label className={LABEL_CLASS}>Full name<span className="text-red-500 ml-1">*</span></label>
        <input
          required
          value={value.full_name}
          onChange={e => update('full_name', e.target.value)}
          placeholder="Jane Smith"
          className={INPUT_CLASS}
          disabled={disabled}
        />
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
      <div>
        <label className={LABEL_CLASS}>Access instructions (optional)</label>
        <textarea
          value={value.customer_notes}
          onChange={e => update('customer_notes', e.target.value)}
          rows={2}
          placeholder="Key under mat, gate code, pet at home..."
          className={`${INPUT_CLASS} resize-none`}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
