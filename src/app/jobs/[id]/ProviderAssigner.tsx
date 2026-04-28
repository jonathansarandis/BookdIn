// @ts-nocheck
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCog, Check, Loader2, X } from 'lucide-react'

interface Provider {
  id: string
  display_name: string
  color: string | null
}

interface Props {
  jobId: string
  currentProviderId: string | null
  currentProviderName: string | null
  currentProviderColor: string | null
  providers: Provider[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ProviderAssigner({ jobId, currentProviderId, currentProviderName, currentProviderColor, providers }: Props) {
  const [providerId, setProviderId] = useState<string | null>(currentProviderId)
  const [providerName, setProviderName] = useState<string | null>(currentProviderName)
  const [providerColor, setProviderColor] = useState<string | null>(currentProviderColor)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function handleAssign(id: string | null) {
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('jobs')
      .update({ provider_id: id })
      .eq('id', jobId)

    setSaving(false)
    if (!error) {
      const provider = providers.find(p => p.id === id)
      setProviderId(id)
      setProviderName(provider?.display_name || null)
      setProviderColor(provider?.color || null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="space-y-3">
      {/* Current assignment */}
      {providerId && providerName ? (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: providerColor || '#2563FF' }}
            >
              {getInitials(providerName)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{providerName}</p>
              <p className="text-xs text-green-600">Assigned</p>
            </div>
          </div>
          <button
            onClick={() => handleAssign(null)}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove provider"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <UserCog className="w-4 h-4 text-amber-500" />
          <p className="text-sm text-amber-700">No provider assigned</p>
        </div>
      )}

      {/* Provider selector */}
      {providers.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            {providerId ? 'Change provider' : 'Assign a provider'}
          </p>
          <div className="space-y-1.5">
            {providers.map(provider => (
              <button
                key={provider.id}
                onClick={() => handleAssign(provider.id)}
                disabled={saving || provider.id === providerId}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all"
                style={{
                  background: provider.id === providerId ? 'rgba(37,99,255,0.05)' : '#fff',
                  borderColor: provider.id === providerId ? '#2563FF' : '#e5e7eb',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: provider.color || '#2563FF', fontSize: '11px', fontWeight: 700 }}
                >
                  {getInitials(provider.display_name)}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">{provider.display_name}</span>
                {provider.id === providerId && (
                  <Check className="w-4 h-4 text-brand-600" />
                )}
                {saving && provider.id !== providerId && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {saved && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Provider updated
        </p>
      )}

      {providers.length === 0 && (
        <p className="text-xs text-gray-400">
          No providers set up yet. <a href="/providers" className="text-brand-600 hover:underline">Add providers →</a>
        </p>
      )}
    </div>
  )
}
