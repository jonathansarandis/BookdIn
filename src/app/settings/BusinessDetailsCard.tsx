'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'

const BN_LABELS = ['ABN', 'EIN', 'GST', 'VAT', 'Other']

export default function BusinessDetailsCard({ businessId }: { businessId?: string }) {
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [suburb, setSuburb] = useState('')
  const [state, setState] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('Australia')
  const [bnLabel, setBnLabel] = useState('ABN')
  const [bnNumber, setBnNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    supabase
      .from('businesses')
      .select('phone, website, street_address, suburb, state, postcode, country, business_number, business_number_label')
      .eq('id', businessId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone || '')
          setWebsite(data.website || '')
          setStreetAddress(data.street_address || '')
          setSuburb(data.suburb || '')
          setState(data.state || '')
          setPostcode(data.postcode || '')
          setCountry(data.country || 'Australia')
          setBnLabel(data.business_number_label || 'ABN')
          setBnNumber(data.business_number || '')
        }
        setLoading(false)
      })
  }, [businessId])

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('businesses')
      .update({
        phone: phone || null,
        website: website || null,
        street_address: streetAddress || null,
        suburb: suburb || null,
        state: state || null,
        postcode: postcode || null,
        country: country || null,
        business_number: bnNumber || null,
        business_number_label: bnLabel || 'ABN',
      })
      .eq('id', businessId)
    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Business details</h3>
        <p className="text-xs text-gray-500 mt-0.5">These details appear on customer emails, invoices, and quotes.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+61 400 000 000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com.au"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Street address</label>
            <input
              type="text"
              value={streetAddress}
              onChange={e => setStreetAddress(e.target.value)}
              placeholder="123 Collins Street"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Suburb</label>
              <input
                type="text"
                value={suburb}
                onChange={e => setSuburb(e.target.value)}
                placeholder="Melbourne"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="VIC"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
              <input
                type="text"
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                placeholder="3000"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Australia"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Business number label</label>
              <select
                value={bnLabel}
                onChange={e => setBnLabel(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {BN_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Business number</label>
              <input
                type="text"
                value={bnNumber}
                onChange={e => setBnNumber(e.target.value)}
                placeholder="12 345 678 901"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !businessId}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save details'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
