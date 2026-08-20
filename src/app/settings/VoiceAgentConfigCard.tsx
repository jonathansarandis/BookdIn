// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, Phone, Bot, Eye, EyeOff } from 'lucide-react'

const CHARLOTTE_VOICE_ID = 'XB0fDUnXU5powFXDhCwa'

const DEFAULT_PERSONALITY = `You are Aria, the booking assistant for {{business_name}}. We offer residential cleaning, end of lease cleans, and deep cleans.`

export default function VoiceAgentConfigCard({ businessId }: { businessId?: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [creatingAssistant, setCreatingAssistant] = useState(false)
  const [assistantStatus, setAssistantStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [agentName, setAgentName] = useState('Aria')
  const [personality, setPersonality] = useState('')
  const [knowledgeBase, setKnowledgeBase] = useState('')
  const [businessHours, setBusinessHours] = useState('')
  const [voicePreset, setVoicePreset] = useState<'charlotte' | 'custom'>('charlotte')
  const [customVoiceId, setCustomVoiceId] = useState('')
  const [vapiAssistantId, setVapiAssistantId] = useState<string | null>(null)

  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [sipUsername, setSipUsername] = useState('')
  const [sipPassword, setSipPassword] = useState('')       // plaintext, only used when saving
  const [hasSipPassword, setHasSipPassword] = useState(false)
  const [showSipPassword, setShowSipPassword] = useState(false)
  const [sipDomain, setSipDomain] = useState('')
  const [sipPort, setSipPort] = useState('5060')
  const [vapiSipPhoneNumberId, setVapiSipPhoneNumberId] = useState<string | null>(null)
  const [connectingSip, setConnectingSip] = useState(false)
  const [sipConnectStatus, setSipConnectStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    supabase
      .from('businesses')
      .select('voice_enabled, voice_phone_number, voice_agent_name, voice_agent_personality, voice_agent_knowledge, voice_business_hours, voice_provider, voice_id, vapi_assistant_id, voice_sip_username, voice_sip_domain, voice_sip_port, voice_sip_password_encrypted, vapi_sip_phone_number_id')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (data) {
          setEnabled(!!data.voice_enabled)
          setPhoneNumber(data.voice_phone_number || '')
          setAgentName(data.voice_agent_name || 'Aria')
          setPersonality(data.voice_agent_personality || '')
          setKnowledgeBase(data.voice_agent_knowledge || '')
          setBusinessHours(data.voice_business_hours || '')
          setVapiAssistantId(data.vapi_assistant_id || null)
          if (data.voice_id && data.voice_id !== CHARLOTTE_VOICE_ID) {
            setVoicePreset('custom')
            setCustomVoiceId(data.voice_id)
          } else {
            setVoicePreset('charlotte')
          }
          setSipUsername(data.voice_sip_username || '')
          setSipDomain(data.voice_sip_domain || '')
          setSipPort(String(data.voice_sip_port || 5060))
          setHasSipPassword(!!data.voice_sip_password_encrypted)
          setVapiSipPhoneNumberId(data.vapi_sip_phone_number_id || null)
        }
        setLoading(false)
      })
  }, [businessId])

  const effectiveVoiceId = voicePreset === 'charlotte' ? CHARLOTTE_VOICE_ID : customVoiceId

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)

    const payload: any = {
      business_id: businessId,
      voice_enabled: enabled,
      voice_phone_number: phoneNumber || null,
      voice_agent_name: agentName || 'Aria',
      voice_agent_personality: personality || null,
      voice_agent_knowledge: knowledgeBase || null,
      voice_business_hours: businessHours || null,
      voice_provider: 'elevenlabs',
      voice_id: effectiveVoiceId || CHARLOTTE_VOICE_ID,
      voice_sip_username: sipUsername || null,
      voice_sip_domain: sipDomain || null,
      voice_sip_port: sipPort || 5060,
    }
    // Only include the SIP password if the user typed something — else preserve existing
    if (sipPassword) payload.voice_sip_password = sipPassword

    const res = await fetch('/api/settings/voice', {
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
    setSipPassword('')      // clear plaintext from form after save
    if (payload.voice_sip_password) setHasSipPassword(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleConnectSip() {
    if (!businessId) return
    setConnectingSip(true)
    setSipConnectStatus(null)
    const res = await fetch('/api/voice/vapi/create-sip-trunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId }),
    })
    const data = await res.json().catch(() => null)
    setConnectingSip(false)
    if (!res.ok) {
      setSipConnectStatus({ ok: false, message: data?.error || `Connect failed (${res.status})` })
      return
    }
    setVapiSipPhoneNumberId(data.phone_number_id)
    setSipConnectStatus({ ok: true, message: 'Connected — Aria will answer calls to this number.' })
  }

  async function handleCreateAssistant() {
    if (!businessId) return
    setCreatingAssistant(true)
    setAssistantStatus(null)
    const res = await fetch('/api/voice/vapi/create-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId }),
    })
    const data = await res.json().catch(() => null)
    setCreatingAssistant(false)
    if (!res.ok) {
      setAssistantStatus({ ok: false, message: data?.error || `Failed (${res.status})` })
      return
    }
    setVapiAssistantId(data.assistant_id)
    setAssistantStatus({ ok: true, message: 'Voice assistant is live and up to date' })
  }

  async function handleTestCall() {
    if (!businessId || !testPhone) return
    setTesting(true)
    setTestResult(null)
    const res = await fetch('/api/settings/voice/test', {
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
    setTestResult({ ok: true, message: data?.message || 'Test call started' })
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading voice agent settings…
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Voice agent
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            An AI agent answers your phone, quotes prices, checks availability, and books jobs straight into BookdIn.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
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
          <label className="block text-xs text-gray-600 mb-1">Phone number customers call</label>
          <input
            type="text"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            placeholder="+61385551234"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Agent name</label>
          <input
            type="text"
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
            placeholder="Aria"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Voice</label>
        <div className="flex gap-2">
          <select
            value={voicePreset}
            onChange={e => setVoicePreset(e.target.value as any)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="charlotte">Charlotte — Australian female (default)</option>
            <option value="custom">Custom ElevenLabs voice ID</option>
          </select>
          {voicePreset === 'custom' && (
            <input
              type="text"
              value={customVoiceId}
              onChange={e => setCustomVoiceId(e.target.value)}
              placeholder="ElevenLabs voice ID"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Browse more Australian voices in the ElevenLabs Voice Library, then paste the voice ID here.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Personality / script</label>
        <textarea
          value={personality}
          onChange={e => setPersonality(e.target.value)}
          rows={4}
          placeholder={DEFAULT_PERSONALITY}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Extra instructions appended to the agent's script — mention the services and areas you cover.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Business hours</label>
        <input
          type="text"
          value={businessHours}
          onChange={e => setBusinessHours(e.target.value)}
          placeholder="e.g. Tue-Thu until 8pm, Fri-Mon until 5pm"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Told to callers so Aria knows when the office is actually open vs. when she's taking after-hours bookings. This is separate from your Dialpad call-forwarding schedule — update both if your hours change.
        </p>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Knowledge base (packages, add-ons, policies)</label>
        <textarea
          value={knowledgeBase}
          onChange={e => setKnowledgeBase(e.target.value)}
          rows={8}
          placeholder="Package inclusions, add-on pricing and quote-only rules, customisation policy, FAQs, guarantee wording, things Aria should never say..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Reference knowledge only — Aria won't recite this out loud, she draws on it when a caller asks something specific it answers.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
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

      {/* Vapi assistant */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-gray-700">Vapi assistant</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {vapiAssistantId ? `Live — ${vapiAssistantId}` : 'Not created yet — save your settings, then create the assistant.'}
            </p>
          </div>
          <button
            onClick={handleCreateAssistant}
            disabled={creatingAssistant}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {creatingAssistant && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {vapiAssistantId ? 'Update assistant' : 'Create assistant'}
          </button>
        </div>
        {assistantStatus && (
          <p className={`text-xs ${assistantStatus.ok ? 'text-green-600' : 'text-red-600'}`}>{assistantStatus.message}</p>
        )}
      </div>

      {/* SIP trunk (Dialpad) */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-gray-700">Connect via Dialpad SIP trunk</h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Route your existing Dialpad number to Aria after hours, without porting it to Twilio.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-[11px] font-medium text-gray-600 mb-1">Where to find your SIP credentials in Dialpad</p>
          <ol className="text-[11px] text-gray-500 space-y-0.5 list-decimal list-inside">
            <li>Log in to Dialpad and go to <strong>Settings → Office → Desk phones</strong></li>
            <li>Click <strong>Add desk phone → Generic SIP phone</strong></li>
            <li>Dialpad will show the SIP username, password, and server (domain) — copy them into the fields below</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">SIP username</label>
            <input
              type="text"
              value={sipUsername}
              onChange={e => setSipUsername(e.target.value)}
              placeholder="e.g. 5657954197127168"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              SIP password {hasSipPassword && <span className="text-green-600">(saved)</span>}
            </label>
            <div className="relative">
              <input
                type={showSipPassword ? 'text' : 'password'}
                value={sipPassword}
                onChange={e => setSipPassword(e.target.value)}
                placeholder={hasSipPassword ? '•••••••• (leave blank to keep)' : 'Paste SIP password'}
                className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSipPassword(!showSipPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showSipPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Encrypted at rest. Once saved, it's never displayed again.</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">SIP domain / server</label>
            <input
              type="text"
              value={sipDomain}
              onChange={e => setSipDomain(e.target.value)}
              placeholder="e.g. sip.dialpad.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">SIP port</label>
            <input
              type="text"
              value={sipPort}
              onChange={e => setSipPort(e.target.value)}
              placeholder="5060"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectSip}
            disabled={connectingSip || !vapiAssistantId || !sipUsername || (!hasSipPassword && !sipPassword) || !sipDomain}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {connectingSip && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {vapiSipPhoneNumberId ? 'Reconnect via SIP' : 'Connect via SIP'}
          </button>
          {sipConnectStatus && (
            <span className={`text-xs ${sipConnectStatus.ok ? 'text-green-600' : 'text-red-600'}`}>{sipConnectStatus.message}</span>
          )}
        </div>
        {!vapiAssistantId && (
          <p className="text-[10px] text-gray-400">Create the assistant above first, then save your SIP credentials to connect.</p>
        )}
      </div>

      {/* Test call */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> Test call
        </h4>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="0421240111 or +61421240111"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={handleTestCall}
            disabled={testing || !testPhone || !vapiAssistantId}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Call this number
          </button>
        </div>
        {!vapiAssistantId && (
          <p className="text-[10px] text-gray-400 mt-1">Create the assistant first to enable test calls.</p>
        )}
        {testResult && (
          <p className={`text-xs mt-2 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>
        )}
      </div>

      {/* Twilio instructions (alternative to Dialpad SIP trunk above) */}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Alternative: connect via Twilio</h4>
        <p className="text-[10px] text-gray-400 mb-1">Already using Dialpad? Use "Connect via SIP" above instead — no need for the steps below.</p>
        <ol className="text-[11px] text-gray-500 space-y-1 list-decimal list-inside">
          <li>Buy or port a number in your Twilio account.</li>
          <li>In the Vapi dashboard, go to Phone Numbers → Import → Twilio, and paste your Account SID, Auth Token, and the number.</li>
          <li>Once imported, set that number's assistant to the one created above.</li>
          <li>Enter the same number in the "Phone number customers call" field here and save.</li>
        </ol>
      </div>
    </div>
  )
}
