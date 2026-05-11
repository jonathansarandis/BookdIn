'use client'

import { BuiltinFieldProps, TncCheckboxValue } from './types'

interface Context {
  tncUrl: string
}

interface Props extends BuiltinFieldProps<TncCheckboxValue, Context> {}

export default function TncCheckboxField({ value, onChange, context, disabled }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={e => { if (!disabled) onChange(e.target.checked) }}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          disabled={disabled}
        />
        <span className="text-sm text-gray-700">
          I agree to the{' '}
          <a
            href={context.tncUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-gray-900 hover:text-gray-700"
          >
            Terms & Conditions
          </a>
        </span>
      </label>
    </div>
  )
}
