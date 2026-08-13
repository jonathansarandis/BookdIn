'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download } from 'lucide-react'
import DateRangePicker from './DateRangePicker'

export default function BookingsToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync if the URL changes from elsewhere (e.g. back button).
  useEffect(() => {
    setQ(searchParams.get('q') || '')
  }, [searchParams])

  function updateParams(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`/jobs?${params.toString()}`)
  }

  function onSearchChange(value: string) {
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value || null })
    }, 350)
  }

  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const exportHref = `/api/jobs/export?${searchParams.toString()}`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DateRangePicker
        from={from}
        to={to}
        onChange={range => updateParams({ from: range.from, to: range.to })}
      />

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={q}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Customer, address or ID"
          className="text-xs pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white w-52"
        />
      </div>

      <a
        href={exportHref}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-gray-300 bg-white transition-colors"
        title="Export bookings as CSV"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </a>
    </div>
  )
}
