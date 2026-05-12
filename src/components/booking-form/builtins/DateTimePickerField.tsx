'use client'

import { BuiltinFieldProps, DateTimeValue, INPUT_CLASS, LABEL_CLASS } from './types'

const TIME_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

interface Context {
  businessTimezone?: string | null
}

interface Props extends BuiltinFieldProps<DateTimeValue, Context> {}

export default function DateTimePickerField({ value, onChange, disabled }: Props) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Preferred date & time</h3>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div className="min-w-0 relative">
          <label className={LABEL_CLASS}>Date *</label>
          <input
            type="date"
            required
            value={value.scheduled_date}
            min={today}
            onChange={e => onChange({ ...value, scheduled_date: e.target.value })}
            className={`${INPUT_CLASS}${!value.scheduled_date ? ' blank-date' : ''}`}
            style={{ width: '100%', minWidth: 0, height: '42px', WebkitAppearance: 'none', appearance: 'none' } as React.CSSProperties}
            disabled={disabled}
          />
          {!value.scheduled_date && (
            <span className="pointer-events-none absolute inset-0 top-[26px] flex items-center px-3 text-sm text-gray-400">
              Select date
            </span>
          )}
        </div>
        <div className="min-w-0 relative">
          <label className={LABEL_CLASS}>Time *</label>
          <select
            value={value.scheduled_time}
            onChange={e => onChange({ ...value, scheduled_time: e.target.value })}
            className={INPUT_CLASS}
            style={{ width: '100%', height: '42px' }}
            disabled={disabled || value.is_flexible}
          >
            <option value="">Pick a time</option>
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>
                {new Date(`2000-01-01T${t}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_flexible}
          onChange={e => onChange({ ...value, is_flexible: e.target.checked, scheduled_time: e.target.checked ? '' : value.scheduled_time })}
          className="h-4 w-4 rounded border-gray-300"
          disabled={disabled}
        />
        <span className="text-sm text-gray-600">I'm flexible with timing</span>
      </label>
    </div>
  )
}
