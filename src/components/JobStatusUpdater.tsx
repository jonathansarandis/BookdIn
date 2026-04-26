'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Loader2 } from 'lucide-react'
import { JOB_STATUS_LABELS } from '@/lib/utils'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:     ['confirmed', 'cancelled'],
  confirmed:   ['assigned', 'cancelled', 'rescheduled'],
  assigned:    ['on_the_way', 'cancelled', 'rescheduled'],
  on_the_way:  ['in_progress'],
  in_progress: ['completed', 'no_show'],
  completed:   [],
  cancelled:   [],
  rescheduled: ['confirmed'],
  no_show:     [],
}

interface Props {
  jobId: string
  currentStatus: string
  providers: { id: string; display_name: string }[]
  currentProviderId: string | null
}

export default function JobStatusUpdater({ jobId, currentStatus, providers, currentProviderId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState(currentProviderId || '')
  const [open, setOpen] = useState(false)

  const nextStatuses = STATUS_TRANSITIONS[currentStatus] || []

  async function updateStatus(newStatus: string) {
    setLoading(true)
    const supabase = createClient()

    await supabase.from('jobs').update({
      status: newStatus,
      ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    }).eq('id', jobId)

    await supabase.from('activity_logs').insert({
      business_id: (await supabase.from('jobs').select('business_id').eq('id', jobId).single()).data?.business_id,
      event_type: `job_${newStatus}`,
      description: `Job status changed to ${JOB_STATUS_LABELS[newStatus]}`,
      entity_type: 'job',
      entity_id: jobId,
    })

    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function assignProvider() {
    if (!selectedProvider) return
    setLoading(true)
    const supabase = createClient()

    await supabase.from('jobs').update({
      provider_id: selectedProvider,
      status: currentStatus === 'pending' ? 'assigned' : currentStatus,
    }).eq('id', jobId)

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {/* Provider assignment */}
      {providers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="">Assign provider...</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          {selectedProvider && selectedProvider !== currentProviderId && (
            <button onClick={assignProvider} disabled={loading}
              className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
              Assign
            </button>
          )}
        </div>
      )}

      {/* Status update */}
      {nextStatuses.length > 0 && (
        <div className="relative">
          <button onClick={() => setOpen(!open)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Update status
            <ChevronDown className="w-3 h-3" />
          </button>
          {open && (
            <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-44">
              {nextStatuses.map(status => (
                <button key={status} onClick={() => updateStatus(status)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  → {JOB_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
