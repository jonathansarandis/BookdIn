'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const STATUSES = [
  { label: 'Pending',     value: 'pending' },
  { label: 'Confirmed',   value: 'confirmed' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Cancelled',   value: 'cancelled' },
]

function pillClass(active: boolean) {
  return cn(
    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
    active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
  )
}

export default function StatusFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = searchParams.get('status') || ''
  const selected = new Set(raw ? raw.split(',').filter(Boolean) : [])

  function applyStatuses(next: Set<string>) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.size === 0) params.delete('status')
    else params.set('status', Array.from(next).join(','))
    router.push(`/jobs?${params.toString()}`)
  }

  function toggle(value: string) {
    const next = new Set(selected)
    if (value === 'cancelled') {
      // Cancelled is exclusive of everything else — its $ figures shouldn't quietly get
      // mixed into a combined total with statuses that represent real upcoming/collectable
      // revenue, so selecting it clears any other selection instead of adding to it.
      next.clear()
      if (!selected.has('cancelled')) next.add('cancelled')
    } else {
      next.delete('cancelled')
      if (next.has(value)) next.delete(value)
      else next.add(value)
    }
    applyStatuses(next)
  }

  const isAll = selected.size === 0

  return (
    <div className="flex gap-1.5 flex-wrap">
      <button onClick={() => applyStatuses(new Set())} className={pillClass(isAll)}>
        All
      </button>
      {STATUSES.map(s => (
        <button key={s.value} onClick={() => toggle(s.value)} className={pillClass(selected.has(s.value))}>
          {s.label}
        </button>
      ))}
    </div>
  )
}
