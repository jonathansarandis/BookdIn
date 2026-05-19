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
          <label className={LABEL_CLASS}>Date<span className="text-red-500 ml-1">*</span></label>
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
          {value.scheduled_date && (
            <p className="mt-1 text-xs text-gray-500">
              {new Date(`${value.scheduled_date}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>
        <div className="min-w-0 relative">
          <label className={LABEL_CLASS}>Time<span className="text-red-500 ml-1">*</span></label>
          <select
            value={value.scheduled_time}
            onChange={e => onChange({ ...value, scheduled_time: e.target.value, is_flexible: e.target.value === 'flexible' })}
            className={INPUT_CLASS}
            style={{ width: '100%', height: '42px' }}
            disabled={disabled}
          >
            <option value="flexible">Flexible time</option>
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>
                {new Date(`2000-01-01T${t}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
