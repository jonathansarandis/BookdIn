// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, MessageSquare, Eye, EyeOff } from 'lucide-react'

const DEFAULT_TEMPLATE = `Hi {{customer_name}}, Thanks so much for booking with {{business_name}}! All details can be found in your confirmation email. Don't hesitate to reach out if you have any questions. We look forward to working with you!`

const AVAILABLE_VARS = [
  { key: '{{customer_name}}', desc: 'Customer first name' },
  { key: '{{service_name}}', desc: 'Service booked' },
  { key: '{{date}}', desc: 'Booking date (e.g. Mon, 12 May)' },
  { key: '{{time}}', desc: 'Booking time (e.g. 10:30 am)' },
  { key: '{{business_name}}', desc: 'Your business name' },
  { key: '{{business_phone}}', desc: 'Your business phone' },
]

export default function SmsConfigCard({ businessId }: { businessId?: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Form state
  const [enabled, setEnabled] = useState(false)
  const [provider, setProvider] = useState<'dialpad' | ''>('')
  const [apiKey, setApiKey] = useState('')              // plaintext, only used when saving
  const [hasApiKey, setHasApiKey] = useState(false)     // server tells us if a key is configured
  const [showApiKey, setShowApiKey] = useState(false)
  const [userId, setUserId] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)

  // Test send
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    supabase
      .from('businesses')
      .select('sms_provider, sms_user_id, sms_from_number, sms_template, sms_enabled, sms_api_key_encrypted')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.sms_enabled)
          setProvider((data.sms_provider as any) || '')
          setUserId(data.sms_user_id || '')
          setFromNumber(data.sms_from_number || '')
          setTemplate(data.sms_template || DEFAULT_TEMPLATE)
          setHasApiKey(!!data.sms_api_key_encrypted)
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
      sms_provider: provider || null,
      sms_user_id: userId || null,
      sms_from_number: fromNumber || null,
      sms_template: template || null,
      sms_enabled: enabled,
    }
    // Only include api_key if user typed something — else preserve existing
    if (apiKey) payload.sms_api_key = apiKey

    const res = await fetch('/api/settings/sms', {
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
    setApiKey('')           // clear plaintext from form after save
    if (payload.sms_api_key) setHasApiKey(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTest() {
    if (!businessId || !testPhone) return
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/settings/sms/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId, to_phone: testPhone }),
    })
    const data = await res.json().catch(() => null)
    setTesting(false)
    if (!res.ok) {
      setTestResult({ ok: false, message: data?.error || `Test failed (${res.status})` })
      return
    }
    setTestResult({ ok: true, message: data?.message || 'Test SMS sent — check your phone' })
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading SMS settings…
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS notifications
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Send a confirmation SMS to customers in addition to the email. Currently supports Dialpad.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-checked:bg-brand-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Provider</label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">— Select —</option>
            <option value="dialpad">Dialpad</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">From number</label>
          <input
            type="text"
            value={fromNumber}
            onChange={e => setFromNumber(e.target.value)}
            placeholder="+61485983907"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">User ID (Dialpad)</label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="5657954197127168"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">
            API key {hasApiKey && <span className="text-green-600">(saved)</span>}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={hasApiKey ? '•••••••• (leave blank to keep)' : 'Paste Dialpad API key'}
              className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Keys are encrypted at rest. Once saved, they're never displayed again.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Message template</label>
        <textarea
          value={template}
          onChange={e => setTemplate(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AVAILABLE_VARS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setTemplate(t => t + v.key)}
              className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              title={v.desc}
            >
              {v.key}
            </button>
          ))}
        </div>
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

      {/* Test SMS section */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Send test SMS</h4>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="0421240111 or +61421240111"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={handleTest}
            disabled={testing || !testPhone || !hasApiKey}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send test
          </button>
        </div>
        {!hasApiKey && (
          <p className="text-[10px] text-gray-400 mt-1">Save an API key first to enable testing.</p>
        )}
        {testResult && (
          <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.message}
          </p>
        )}
      </div>
    </div>
  )
}
