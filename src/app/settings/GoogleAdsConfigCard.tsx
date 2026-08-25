// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, BarChart2, Eye, EyeOff, ExternalLink } from 'lucide-react'

export default function GoogleAdsConfigCard({ businessId }: { businessId?: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [hasDeveloperToken, setHasDeveloperToken] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [conversionActionId, setConversionActionId] = useState('')

  const [developerToken, setDeveloperToken] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!businessId) return
    load()
  }, [businessId])

  function load() {
    setLoading(true)
    supabase
      .from('businesses')
      .select('google_ads_customer_id, google_ads_enabled, google_ads_developer_token_encrypted, google_ads_connected_email, google_ads_conversion_action_id')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.google_ads_enabled)
          setCustomerId(data.google_ads_customer_id || '')
          setHasDeveloperToken(!!data.google_ads_developer_token_encrypted)
          setConnectedEmail(data.google_ads_connected_email || null)
          setConversionActionId(data.google_ads_conversion_action_id || '')
        }
        setLoading(false)
      })
  }

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    const payload: any = {
      business_id: businessId,
      google_ads_customer_id: customerId || null,
      google_ads_enabled: enabled,
      google_ads_conversion_action_id: conversionActionId || null,
    }
    if (developerToken) payload.developer_token = developerToken

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
    if (developerToken) setHasDeveloperToken(true)
    setDeveloperToken('')
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleDisconnect() {
    if (!businessId) return
    setDisconnecting(true)
    setSaveError(null)
    const res = await fetch('/api/settings/google-ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Customer ID intentionally omitted — disconnect only revokes the Google OAuth
      // session server-side now; it no longer touches google_ads_customer_id at all.
      body: JSON.stringify({ business_id: businessId, google_ads_enabled: false, disconnect: true }),
    })
    setDisconnecting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setSaveError(data?.error || `Disconnect failed (${res.status})`)
      return
    }
    setEnabled(false)
    setConnectedEmail(null)
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
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-checked:bg-brand-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-700">Google account</p>
          {connectedEmail ? (
            <p className="text-xs text-green-700 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Connected as {connectedEmail}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {connectedEmail && (
            // "Connected" only reflects that we have stored credentials — Google can
            // silently invalidate them (e.g. the OAuth app being in Testing mode expires
            // refresh tokens after 7 days) without us knowing until the next live API
            // call fails. Always offering Reconnect here, not just Disconnect, means
            // fixing a stale connection doesn't require disconnecting first and losing
            // the Customer ID / developer token fields in the meantime.
            <a
              href="/api/settings/google-ads/connect"
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-brand-600 border border-gray-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              Reconnect <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {connectedEmail ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {disconnecting && <Loader2 className="w-3 h-3 animate-spin" />}
              Disconnect
            </button>
          ) : (
            <a
              href="/api/settings/google-ads/connect"
              className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              Connect with Google <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Customer ID</label>
        <input
          type="text" value={customerId} onChange={e => setCustomerId(e.target.value)}
          placeholder="940-768-7925"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">
          Developer token {hasDeveloperToken && <span className="text-green-600">(saved)</span>}
        </label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={developerToken}
            onChange={e => setDeveloperToken(e.target.value)}
            placeholder={hasDeveloperToken ? '•••••••• (leave blank to keep)' : 'Paste developer token from Google Ads API Center'}
            className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400">
        The developer token is encrypted at rest and never displayed again once saved — leave the field blank to keep its current value.
        Connecting your Google account handles the rest of the OAuth flow automatically.
      </p>

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-xs text-gray-600 mb-1">Conversion action (optional)</label>
        <input
          type="text" value={conversionActionId} onChange={e => setConversionActionId(e.target.value)}
          placeholder="e.g. 987654321 or customers/123.../conversionActions/987..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          When a job is marked completed, its gclid (if captured at booking) is uploaded to this
          conversion action, so Google Ads can tell paying customers apart from leads who never
          proceeded or cancelled. Create it in Google Ads under Tools &amp; Settings → Conversions →
          New conversion action → Import → Other data sources or CRMs → Track conversions from
          clicks, then paste its ID or resource name here.
        </p>
      </div>

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
