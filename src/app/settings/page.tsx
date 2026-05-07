// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'

const TIMEZONES = [
  { label: 'Melbourne / Sydney (AEST)', value: 'Australia/Melbourne' },
  { label: 'Brisbane (AEST no DST)', value: 'Australia/Brisbane' },
  { label: 'Adelaide (ACST)', value: 'Australia/Adelaide' },
  { label: 'Perth (AWST)', value: 'Australia/Perth' },
  { label: 'Darwin (ACST no DST)', value: 'Australia/Darwin' },
  { label: 'Hobart (AEST)', value: 'Australia/Hobart' },
  { label: 'Auckland (NZST)', value: 'Pacific/Auckland' },
  { label: 'London (GMT)', value: 'Europe/London' },
  { label: 'New York (EST)', value: 'America/New_York' },
  { label: 'Los Angeles (PST)', value: 'America/Los_Angeles' },
]

const CURRENCIES = [
  { label: 'AUD — Australian Dollar', value: 'AUD' },
  { label: 'NZD — New Zealand Dollar', value: 'NZD' },
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'GBP — British Pound', value: 'GBP' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'CAD — Canadian Dollar', value: 'CAD' },
  { label: 'SGD — Singapore Dollar', value: 'SGD' },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [business, setBusiness] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currency, setCurrency] = useState('')
  const [timezone, setTimezone] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showTax, setShowTax] = useState(false)
  const [taxRate, setTaxRate] = useState('')
  const [taxName, setTaxName] = useState('Tax')
  const [taxMode, setTaxMode] = useState<'exclusive' | 'inclusive'>('exclusive')
  const [taxSaving, setTaxSaving] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Check for Stripe Connect redirect params
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_success') === 'true') {
      setFlashMessage({ type: 'success', text: 'Stripe connected successfully! Your customers can now pay online.' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('stripe_error')) {
      setFlashMessage({ type: 'error', text: `Stripe connection failed: ${params.get('stripe_error')}` })
      window.history.replaceState({}, '', window.location.pathname)
    }

    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, businesses(*)')
      .eq('id', user.id)
      .single()

    const biz = Array.isArray(prof?.businesses) ? prof.businesses[0] : prof?.businesses
    setProfile(prof)
    setBusiness(biz)
    setCurrency(biz?.currency || 'AUD')
    setTimezone(biz?.timezone || 'Australia/Melbourne')
    setShowTax(biz?.show_tax || false)
    setTaxRate(biz?.tax_rate != null ? String(biz.tax_rate) : '')
    setTaxName(biz?.tax_name || 'Tax')
    setTaxMode(biz?.tax_mode ?? 'exclusive')
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !business) return
    setLogoUploading(true)
    const MAX_BYTES = 2 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setLogoError(`Logo file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 2MB.`)
      setLogoUploading(false)
      e.target.value = ''
      return
    }
    setLogoError('')
    const path = `${business.id}/logo`
    await supabase.storage.from('logos').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    await supabase.from('businesses').update({ logo_url: urlWithBust }).eq('id', business.id)
    setBusiness({ ...business, logo_url: urlWithBust })
    setLogoUploading(false)
  }

  async function handleLogoRemove() {
    if (!business) return
    await supabase.from('businesses').update({ logo_url: null }).eq('id', business.id)
    await supabase.storage.from('logos').remove([`${business.id}/logo`])
    setBusiness({ ...business, logo_url: null })
  }

  async function handleSaveBusinessInfo() {
    if (!business) return
    setSaving(true)
    const { error } = await supabase
      .from('businesses')
      .update({ currency, timezone })
      .eq('id', business.id)

    setSaving(false)
    if (!error) {
      setSaved(true)
      setBusiness({ ...business, currency, timezone })
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleSaveFinance() {
    if (!business) return
    setTaxSaving(true)
    const { error } = await supabase.from('businesses').update({
      show_tax: showTax,
      tax_rate: taxRate ? parseFloat(taxRate) : 0,
      tax_name: taxName || 'Tax',
      tax_mode: taxMode,
    }).eq('id', business.id)
    setTaxSaving(false)
    if (!error) {
      setTaxSaved(true)
      setBusiness({ ...business, show_tax: showTax, tax_rate: parseFloat(taxRate || '0'), tax_name: taxName, tax_mode: taxMode })
      setTimeout(() => setTaxSaved(false), 3000)
    }
  }

  const stripeConnected = business?.stripe_account_id && business?.stripe_charges_enabled

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar profile={profile} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={profile} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

            {flashMessage && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                flashMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {flashMessage.text}
              </div>
            )}

            {/* Business info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Business info</h3>

              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  {business?.logo_url ? (
                    <img src={business.logo_url} alt="Business logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xl font-bold text-gray-400">{business?.name?.[0] || '?'}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
                    {logoUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {logoUploading ? 'Uploading...' : 'Upload logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                  </label>
                  {business?.logo_url && (
                    <button onClick={handleLogoRemove} className="text-xs text-red-500 hover:text-red-700 text-left transition-colors">
                      Remove logo
                    </button>
                  )}
                  {logoError && (
                    <p className="text-xs text-red-600">{logoError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Business name</p>
                  <p className="font-medium text-gray-900">{business?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Industry</p>
                  <p className="font-medium text-gray-900 capitalize">{business?.industry?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Currency</p>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Timezone</p>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {TIMEZONES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveBusinessInfo}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                {saved && <span className="text-xs text-green-600">✓ Saved</span>}
              </div>
            </div>

            {/* Finance */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Finance</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Show tax breakdown</p>
                  <p className="text-xs text-gray-500 mt-0.5">Display tax separately on invoices and booking summaries</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTax(t => !t)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showTax ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showTax ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {showTax && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">How your prices work</p>
                    <div className="space-y-2">
                      <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${taxMode === 'exclusive' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="tax_mode" value="exclusive" checked={taxMode === 'exclusive'}
                          onChange={() => setTaxMode('exclusive')}
                          className="mt-0.5 w-4 h-4 accent-brand-500" />
                        <div>
                          <p className={`text-sm font-medium ${taxMode === 'exclusive' ? 'text-brand-700' : 'text-gray-900'}`}>Tax exclusive — GST added on top</p>
                          <p className="text-xs text-gray-500 mt-0.5">e.g. $180 service + $18 GST = $198 customer pays</p>
                        </div>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${taxMode === 'inclusive' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="tax_mode" value="inclusive" checked={taxMode === 'inclusive'}
                          onChange={() => setTaxMode('inclusive')}
                          className="mt-0.5 w-4 h-4 accent-brand-500" />
                        <div>
                          <p className={`text-sm font-medium ${taxMode === 'inclusive' ? 'text-brand-700' : 'text-gray-900'}`}>Tax inclusive — prices already include GST</p>
                          <p className="text-xs text-gray-500 mt-0.5">e.g. $198 total price, $18 GST baked in</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tax name</label>
                      <input type="text" value={taxName} onChange={e => setTaxName(e.target.value)}
                        placeholder="GST"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tax rate (%)</label>
                      <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                        placeholder="10"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveFinance}
                  disabled={taxSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {taxSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {taxSaving ? 'Saving...' : 'Save finance settings'}
                </button>
                {taxSaved && <span className="text-xs text-green-600">✓ Saved</span>}
              </div>
            </div>

            {/* Stripe Connect */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#635BFF] flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.43 0-7.26-2.96-7.26-7.67 0-4.3 2.49-7.71 6.54-7.71 4.05 0 6.09 3.41 6.09 7.66 0 .67-.07 1.17-.1 1.97zm-6.07-5.03c-1.25 0-2.07.88-2.25 2.3h4.48c-.19-1.43-.99-2.3-2.23-2.3zm-20.16 5.03h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.43 0-7.26-2.96-7.26-7.67 0-4.3 2.49-7.71 6.54-7.71 4.05 0 6.09 3.41 6.09 7.66 0 .67-.07 1.17-.1 1.97zm-6.07-5.03c-1.25 0-2.07.88-2.25 2.3h4.48c-.19-1.43-.99-2.3-2.23-2.3zM14.56.37l-3.76.8v3.14L7.04 5.2v-.12C7.04 2.22 5.49.72 3.3.72 1.48.72 0 2.13 0 4.4c0 2.45 1.68 3.49 3.3 4.12v.07c-1.44.5-3.3 1.68-3.3 4.28C0 15.6 2.1 17.4 4.9 17.4c2.1 0 3.73-.73 4.64-1.96l.22 1.65h3.37V.37h1.43zm-8.52 10.6c-.71-.34-1.41-.71-1.41-1.59 0-.77.52-1.22 1.41-1.22.77 0 1.3.37 1.63.88v2.6c-.33-.22-.89-.46-1.63-.67zm.22 3.95c-1.07 0-1.77-.6-1.77-1.56 0-.95.74-1.55 1.77-1.55.7 0 1.3.3 1.63.71v1.74c-.33.37-.93.66-1.63.66z" fill="white"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Stripe payments</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Accept online payments from your customers</p>
                  </div>
                </div>
                {stripeConnected ? (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">Not connected</span>
                )}
              </div>

              {!business ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : stripeConnected ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Charges</p>
                      <p className="text-sm font-medium text-green-700">✓ Enabled</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Payouts</p>
                      <p className={`text-sm font-medium ${business.stripe_payouts_enabled ? 'text-green-700' : 'text-amber-700'}`}>
                        {business.stripe_payouts_enabled ? '✓ Enabled' : '⚠ Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-400 font-mono">{business.stripe_account_id}</p>
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                    >
                      Stripe Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Connect your Stripe account so customers can pay invoices and bookings online.
                    Funds go directly to your bank — BookdIn never touches your money.
                  </p>
                  <a
                    href="/api/stripe/connect"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF] hover:bg-[#5449e8] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Connect Stripe account
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                </div>
              )}
            </div>

            {/* Account */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Your account</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Name</p>
                  <p className="font-medium text-gray-900">{profile?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="font-medium text-gray-900">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Role</p>
                  <p className="font-medium text-gray-900 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>

            {/* Booking link */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-brand-700 mb-2">Your booking link</h3>
              <p className="text-xs text-brand-600 mb-3">Share this link with customers to let them book online</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-brand-200 px-3 py-2 rounded-lg font-mono text-brand-700 truncate">
                  {process.env.NEXT_PUBLIC_APP_URL || 'https://bookd-in.vercel.app'}/book/{business?.booking_url_slug}
                </code>
                <a
                  href={`/book/${business?.booking_url_slug}`}
                  target="_blank"
                  className="text-xs px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Open
                </a>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
