'use client'

interface Field {
  id: string
  label: string
  field_type: string
  options: any
  required: boolean
}

interface Props {
  field: Field
  value: any
  onChange: (v: any) => void
  disabled?: boolean
}

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] focus:border-transparent'

export default function CustomFieldInput({ field, value, onChange, disabled }: Props) {
  const opts: string[] = Array.isArray(field.options?.options)
    ? field.options.options
    : Array.isArray(field.options)
    ? field.options
    : []

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.field_type === 'text' && (
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Your answer"
          className={INPUT_CLASS}
          disabled={disabled}
          required={field.required}
        />
      )}

      {field.field_type === 'textarea' && (
        <textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Your answer"
          rows={3}
          className={`${INPUT_CLASS} resize-none`}
          disabled={disabled}
          required={field.required}
        />
      )}

      {field.field_type === 'number' && (
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Your answer"
          className={INPUT_CLASS}
          disabled={disabled}
          required={field.required}
        />
      )}

      {field.field_type === 'select' && (
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className={INPUT_CLASS}
          disabled={disabled}
          required={field.required}
        >
          <option value="">Select an option</option>
          {opts.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.field_type === 'radio' && (
        <div className="space-y-2">
          {opts.map(o => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={o}
                checked={value === o}
                onChange={() => onChange(o)}
                disabled={disabled}
                className="h-4 w-4 border-gray-300"
              />
              <span className="text-sm text-gray-700">{o}</span>
            </label>
          ))}
        </div>
      )}

      {field.field_type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{field.label}</span>
        </label>
      )}
    </div>
  )
}
