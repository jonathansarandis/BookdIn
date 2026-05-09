'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  locations: { id: string; name: string }[]
  currentLocationId: string
  month: number
  year: number
}

export default function LocationFilter({ locations, currentLocationId, month, year }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', String(month))
    params.set('year', String(year))
    if (e.target.value) {
      params.set('location', e.target.value)
    } else {
      params.delete('location')
    }
    router.push(`/calendar?${params.toString()}`)
  }

  return (
    <select
      value={currentLocationId}
      onChange={handleChange}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
    >
      <option value="">All locations</option>
      {locations.map(loc => (
        <option key={loc.id} value={loc.id}>{loc.name}</option>
      ))}
    </select>
  )
}
