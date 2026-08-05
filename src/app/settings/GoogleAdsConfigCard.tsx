// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, BarChart2, Eye, EyeOff } from 'lucide-react'

export default function GoogleAdsConfigCard({ businessId }: { businessId?: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [hasCredentials, setHasCredentials] = useState(false)

  const [developerToken, setDeveloperToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [showSecrets, setShowSecrets] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    supabase
      .from('businesses')
      .select('google_ads_customer_id, google_ads_enabled, google_ads_credentials_encrypted')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.google_ads_enabled)
          setCustomerId(data.google_ads_customer_id || '')
          setHasCredentials(!!data.google_ads_credentials_encrypted)
        }
        setLoading(false)
      })
  }, [businessId])

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    const payload: any = {
      business_id: businessId,
      google_ads_customer_id: customerId || null,
      google_ads_enabled: enabled,
    }
    if (developerToken) payload.developer_token = developerToken
    if (clientId) payload.client_id = clientId
    if (clientSecret) payload.client_secret = clientSecret
    if (refreshToken) payload.refresh_token = refreshToken

    const res = await fetch('/api/settings/google-ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)

    setSaving(false)
    if (!res.ok) {
      setSaveError(data?.error || `Save failed (${res.status})`)
      return
    }
    setSaved(true)
    if (developerToken || clientId || clientSecret || refreshToken) setHasCredentials(true)
    setDeveloperToken(''); setClientId(''); setClientSecret(''); setRefreshToken('')
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Google Ads settings…
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            Google Ads
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-populates weekly ad spend per location on the profit report.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-checked:bg-brand-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Customer ID</label>
        <input
          type="text" value={customerId} onChange={e => setCustomerId(e.target.value)}
          placeholder="940-768-7925"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Developer token', value: developerToken, set: setDeveloperToken, placeholder: 'Paste developer token' },
          { label: 'Client ID', value: clientId, set: setClientId, placeholder: 'Paste OAuth client ID' },
          { label: 'Client secret', value: clientSecret, set: setClientSecret, placeholder: 'Paste OAuth client secret' },
          { label: 'Refresh token', value: refreshToken, set: setRefreshToken, placeholder: 'Paste refresh token' },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-xs text-gray-600 mb-1">
              {f.label} {hasCredentials && <span className="text-green-600">(saved)</span>}
            </label>
            <div className="relative">
              <input
                type={showSecrets ? 'text' : 'password'}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={hasCredentials ? '•••••••• (leave blank to keep)' : f.placeholder}
                className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400">
        Credentials are encrypted at rest. Once saved, they're never displayed again — leave a field blank to keep its current value.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
        {saveError && <span className="text-red-600 text-sm">{saveError}</span>}
      </div>
    </div>
  )
}
