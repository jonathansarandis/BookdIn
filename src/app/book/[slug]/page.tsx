// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { createClient } from '@/lib/supabase/client'
import AddonsPicker from '@/components/AddonsPicker'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useUTMCapture } from '@/lib/useUTMCapture'

const FREQUENCIES = [
  { value: 'one_time',    label: 'One-time' },
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly',     label: 'Monthly' },
]

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const utmData = useUTMCapture()
  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<any[]>([])
  const [roomPricing, setRoomPricing] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [freqDiscounts, setFreqDiscounts] = useState<Record<string, { discount_percent: number; is_enabled: boolean }>>({})
  const [locationId, setLocationId] = useState<string | null>(null)
  const [locationTimezone, setLocationTimezone] = useState<string | null>(null)

  const [form, setForm] = useState({
    service_id: '',
    frequency: 'one_time',
    bedrooms: 1,
    bathrooms: 1,
    scheduled_date: '',
    scheduled_time: 'flexible',
    full_name: '',
    email: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    postcode: '',
    customer_notes: '',
  })

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function load() {
      const { data: loc } = await supabase
        .from('locations_public')
        .select('location_id, location_timezone, business_id, business_name, logo_url, brand_color, tax_rate, tax_name, show_tax, tax_mode')
        .eq('location_slug', slug)
        .single()

      if (!loc) { setLoading(false); return }

      setBusiness({
        id: loc.business_id,
        name: loc.business_name,
        logo_url: loc.logo_url,
        brand_color: loc.brand_color,
        tax_rate: loc.tax_rate,
        tax_name: loc.tax_name,
        show_tax: loc.show_tax,
        tax_mode: loc.tax_mode,
      })
      setLocationId(loc.location_id)
      setLocationTimezone(loc.location_timezone)

      const [{ data: locSvcsRaw }, { data: fdData }] = await Promise.all([
        supabase.from('location_services')
          .select(`
            base_price,
            is_enabled,
            services!inner (
              id, name, description, pricing_type, duration_minutes,
              is_active, sort_order, is_popular, is_quote_only, tax_included,
              service_extras (
                id, name, description, duration_minutes, is_active,
                sort_order, is_popular, is_quote_only,
                location_extras!inner ( price, is_enabled, location_id )
              )
            )
          `)
          .eq('location_id', loc.location_id)
          .eq('is_enabled', true)
          .eq('services.is_active', true)
          .order('sort_order', { foreignTable: 'services' }),
        supabase.from('frequency_discounts').select('frequency, discount_percent, is_enabled').eq('business_id', loc.business_id),
      ])

      const flattenedServices = (locSvcsRaw || []).map((row: any) => ({
        ...row.services,
        base_price: row.base_price,
        service_extras: (row.services.service_extras || [])
          .map((ex: any) => {
            const locExtra = (ex.location_extras || []).find((le: any) => le.location_id === loc.location_id && le.is_enabled)
            if (!locExtra) return null
            return { ...ex, price: locExtra.price, location_extras: undefined }
          })
          .filter(Boolean)
      }))
      setServices(flattenedServices)
      if (flattenedServices[0]) update('service_id', flattenedServices[0].id)
      const freqMap: Record<string, { discount_percent: number; is_enabled: boolean }> = {}
      for (const row of fdData || []) freqMap[row.frequency] = { discount_percent: row.discount_percent, is_enabled: row.is_enabled }
      setFreqDiscounts(freqMap)
      setLoading(false)
    }
    load()
  }, [slug])

  // Load room pricing when service changes
  useEffect(() => {
    if (!form.service_id) return
    async function loadServiceData() {
      const { data: rpData } = await supabase.from('room_pricing').select('*').eq('service_id', form.service_id)
      setRoomPricing(rpData || [])
      setSelectedExtras([])
    }
    loadServiceData()
  }, [form.service_id])

  function getFreqDiscount(value: string): number {
    if (value === 'one_time') return 0
    const row = freqDiscounts[value]
    if (!row?.is_enabled) return 0
    return row.discount_percent ?? 0
  }

  const selectedService = services.find(s => s.id === form.service_id)
  const selectedFreq = FREQUENCIES.find(f => f.value === form.frequency)!

  function getRoomPrice(type: string, count: number): number {
    const match = roomPricing.find(r => r.type === type && r.count === count)
    return match?.price || 0
  }

  function getBedroomCounts(): number[] {
    const beds = roomPricing.filter(r => r.type === 'bedroom').map(r => r.count).sort((a, b) => a - b)
    return beds.length > 0 ? beds : [1, 2, 3, 4, 5]
  }

  function getBathroomCounts(): number[] {
    const baths = roomPricing.filter(r => r.type === 'bathroom').map(r => r.count).sort((a, b) => a - b)
    return baths.length > 0 ? baths : [1, 2, 3]
  }

  function calcPrice() {
    if (!selectedService) return 0
    let base = selectedService.base_price

    if (selectedService.pricing_type === 'room_based') {
      base += getRoomPrice('bedroom', form.bedrooms)
      base += getRoomPrice('bathroom', form.bathrooms)
    }

    const extrasTotal = selectedService.service_extras
      ?.filter((ex: any) => selectedExtras.includes(ex.id) && !ex.is_quote_only)
      .reduce((sum: number, ex: any) => sum + ex.price, 0) || 0

    const subtotal = base + extrasTotal
    const freqDisc = getFreqDiscount(form.frequency)
    const discount = freqDisc > 0 ? Math.round(subtotal * freqDisc / 100) : 0
    return subtotal - discount
  }

  const rawPrice = calcPrice()
  const showTaxBreakdown = !!(business && business.tax_rate > 0 && business.show_tax)
  const taxRate = business?.tax_rate ?? 0
  const taxName = business?.tax_name?.trim() || 'Tax'
  const taxMode = business?.tax_mode ?? 'exclusive'
  const taxCents = showTaxBreakdown
    ? taxMode === 'exclusive'
      ? Math.round(rawPrice * taxRate / 100)
      : Math.round(rawPrice * taxRate / (100 + taxRate))
    : 0
  const subtotalCents = taxMode === 'exclusive' ? rawPrice : rawPrice - taxCents
  const totalToCharge = rawPrice + (taxMode === 'exclusive' ? taxCents : 0)

  const brand = business?.brand_color || '#1A6B4A'
  const brandTint = `${brand}14`

  function toggleExtra(id: string) {
    setSelectedExtras(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/bookings/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          service_id: form.service_id,
          frequency: form.frequency,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time,
          total_price: totalToCharge,
          tax_amount: taxCents,
          extras: selectedExtras,
          customer: {
            full_name: form.full_name,
            email: form.email,
            phone: form.phone,
          },
          address: {
            line1: form.line1,
            city: form.city,
            state: form.state,
            postcode: form.postcode,
          },
          customer_notes: form.customer_notes,
          utm_data: utmData,
          bedrooms: selectedService?.pricing_type === 'room_based' ? form.bedrooms : null,
          bathrooms: selectedService?.pricing_type === 'room_based' ? form.bathrooms : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Booking page not found.</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking received!</h2>
          <p className="text-gray-500 text-sm mb-4">
            Thanks {form.full_name.split(' ')[0]}! We've received your booking request and will be in touch shortly to confirm.
          </p>
          <p className="text-sm text-gray-500">
            Check your email at <strong>{form.email}</strong> for a confirmation and secure payment link.
          </p>
        </div>
      </div>
    )
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] focus:border-transparent"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-50" style={{ '--brand-color': brand } as React.CSSProperties}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[var(--brand-color)] flex items-center justify-center overflow-hidden flex-shrink-0">
            {business?.logo_url ? (
              <img
                src={business.logo_url}
                alt={`${business.name} logo`}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-white font-semibold text-lg">
                {business?.name?.charAt(0) ?? ''}
              </span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{business.name}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 overflow-x-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Book a service</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in your details and we'll confirm your booking shortly.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 transition-colors ${step >= s ? 'text-white' : 'bg-gray-200 text-gray-500'}`}
                style={step >= s ? { backgroundColor: brand } : undefined}>
                {step > s ? '✓' : s}
              </div>
              <span className={`hidden sm:inline text-xs font-medium ml-2 ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 1 ? 'Service' : s === 2 ? 'Your details' : 'Confirm'}
              </span>
              {s < 3 && <div className="flex-1 sm:flex-none sm:w-8 h-px bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {/* Step 1: Service */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Select a service</h3>
              <div className="space-y-2">
                {services.map(s => (
                  <label key={s.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${form.service_id === s.id ? '' : 'border-gray-200 hover:border-gray-300'}`}
                    style={form.service_id === s.id ? { borderColor: brand, backgroundColor: brandTint } : undefined}>
                    <div className="flex items-center gap-3 min-w-0">
                      <input type="radio" name="service" value={s.id} checked={form.service_id === s.id}
                        onChange={() => { update('service_id', s.id); setSelectedExtras([]) }}
                        className="sr-only" />
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ borderColor: form.service_id === s.id ? brand : '#d1d5db' }}>
                        {form.service_id === s.id && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brand }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0 whitespace-nowrap ml-2">from ${(s.base_price / 100).toFixed(0)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Frequency</h3>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => {
                  const disc = getFreqDiscount(f.value)
                  return (
                    <button key={f.value} type="button" onClick={() => update('frequency', f.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${form.frequency === f.value ? '' : 'border-gray-200 hover:border-gray-300'}`}
                      style={form.frequency === f.value ? { borderColor: brand, backgroundColor: brandTint } : undefined}>
                      <div className={`text-xs font-medium ${form.frequency === f.value ? '' : 'text-gray-900'}`} style={form.frequency === f.value ? { color: brand } : undefined}>{f.label}</div>
                      {disc > 0 && <div className="text-[10px] text-green-600 mt-0.5">{disc}% discount</div>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Room-based pricing from DB */}
            {selectedService?.pricing_type === 'room_based' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Property size</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Bedrooms</label>
                    <select value={form.bedrooms} onChange={e => update('bedrooms', parseInt(e.target.value))} className={inputClass}>
                      {getBedroomCounts().map(n => (
                        <option key={n} value={n}>{n} bedroom{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Bathrooms</label>
                    <select value={form.bathrooms} onChange={e => update('bathrooms', parseInt(e.target.value))} className={inputClass}>
                      {getBathroomCounts().map(n => (
                        <option key={n} value={n}>{n} bathroom{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {selectedService?.service_extras?.some((e: any) => e.is_active) && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular add-ons</h3>
                <AddonsPicker
                  extras={selectedService.service_extras}
                  selected={selectedExtras}
                  onChange={toggleExtra}
                  brandColor={brand}
                />
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Preferred date & time</h3>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
                <div className="min-w-0 relative">
                  <label className={labelClass}>Date *</label>
                  <input
                    type="date"
                    required
                    value={form.scheduled_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => update('scheduled_date', e.target.value)}
                    className={`${inputClass}${!form.scheduled_date ? ' blank-date' : ''}`}
                    style={{ width: '100%', minWidth: 0, height: '42px', WebkitAppearance: 'none', appearance: 'none' }}
                  />
                  {!form.scheduled_date && (
                    <span className="pointer-events-none absolute inset-0 top-[26px] flex items-center px-3 text-sm text-gray-400">
                      Select date
                    </span>
                  )}
                </div>
                <div className="min-w-0 relative">
                  <label className={labelClass}>Time *</label>
                  <select
                    value={form.scheduled_time}
                    onChange={e => update('scheduled_time', e.target.value)}
                    className={inputClass}
                    style={{ width: '100%', height: '42px' }}
                  >
                    <option value="flexible">Flexible time</option>
                    {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                      <option key={t} value={t}>{new Date(`2000-01-01T${t}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-1 border" style={{ backgroundColor: brandTint, borderColor: `${brand}40` }}>
              {showTaxBreakdown && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: brand }}>Subtotal</span>
                    <span style={{ color: brand }}>${(subtotalCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: brand }}>{taxName} ({taxRate}%)</span>
                    <span style={{ color: brand }}>${(taxCents / 100).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium" style={{ color: brand }}>Estimated total</span>
                <span className="text-xl font-semibold" style={{ color: brand }}>${(totalToCharge / 100).toFixed(2)}</span>
              </div>
              {getFreqDiscount(form.frequency) > 0 && (
                <p className="text-xs text-green-600 mt-1">{getFreqDiscount(form.frequency)}% frequency discount applied</p>
              )}
            </div>

            <button onClick={() => setStep(2)} disabled={!form.service_id || !form.scheduled_date}
              className="w-full py-3 text-white text-sm font-medium rounded-lg transition-all hover:brightness-90 disabled:opacity-50"
              style={{ backgroundColor: brand }}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Customer details */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Your details</h3>
              <div>
                <label className={labelClass}>Full name *</label>
                <input required value={form.full_name} onChange={e => update('full_name', e.target.value)}
                  placeholder="Jane Smith" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input required type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    placeholder="jane@email.com" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input required value={form.phone} onChange={e => update('phone', e.target.value)}
                    placeholder="04xx xxx xxx" className={inputClass} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Service address</h3>
              <AddressAutocomplete
                value={{ line1: form.line1, city: form.city, state: form.state, postcode: form.postcode }}
                onChange={v => setForm(f => ({ ...f, ...v }))}
                stateOptions={['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']}
              />
              <div>
                <label className={labelClass}>Access instructions (optional)</label>
                <textarea value={form.customer_notes} onChange={e => update('customer_notes', e.target.value)}
                  rows={2} placeholder="Key under mat, gate code, pet at home..."
                  className={`${inputClass} resize-none`} />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-gray-900">
                <strong>No payment required now.</strong> After booking you'll receive a secure link by email to save your card details. Your card won't be charged until after your service is complete.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button onClick={() => setStep(3)}
                disabled={!form.full_name || !form.email || !form.phone || !form.line1 || !form.city || !form.state || !form.postcode}
                className="flex-1 py-3 text-white text-sm font-medium rounded-lg transition-all hover:brightness-90 disabled:opacity-50"
                style={{ backgroundColor: brand }}>
                Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Booking summary</h3>
              {[
                { label: 'Service', value: selectedService?.name },
                { label: 'Frequency', value: selectedFreq.label },
                ...(selectedService?.service_extras
                  ?.filter((ex: any) => selectedExtras.includes(ex.id))
                  .map((ex: any) => ({
                    label: ex.name,
                    value: ex.is_quote_only ? 'Custom price' : `+$${(ex.price / 100).toFixed(0)}`,
                  })) ?? []),
                { label: 'Date', value: form.scheduled_date ? new Date(`${form.scheduled_date}T12:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '' },
                { label: 'Time', value: form.scheduled_time === 'flexible' ? 'Flexible time' : new Date(`2000-01-01T${form.scheduled_time}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) },
                ...(selectedService?.pricing_type === 'room_based' ? [
                  { label: 'Bedrooms', value: `${form.bedrooms}` },
                  { label: 'Bathrooms', value: `${form.bathrooms}` },
                ] : []),
                { label: 'Address', value: `${form.line1}, ${form.city} ${form.state} ${form.postcode}` },
                { label: 'Name', value: form.full_name },
                { label: 'Email', value: form.email },
                { label: 'Phone', value: form.phone },
                ...(showTaxBreakdown ? [
                  { label: 'Subtotal', value: `$${(subtotalCents / 100).toFixed(2)}` },
                  { label: `${taxName} (${taxRate}%)`, value: `$${(taxCents / 100).toFixed(2)}` },
                ] : []),
                { label: 'Total', value: `$${(totalToCharge / 100).toFixed(2)}`, bold: true },
              ].map(item => (
                <div key={item.label} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-500 flex-shrink-0">{item.label}</span>
                  <span className={`${item.bold ? 'font-semibold' : 'text-gray-900'} text-right break-words min-w-0`} style={item.bold ? { color: brand } : undefined}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-gray-900">
                <strong>Next step:</strong> After confirming, we'll call you to confirm the booking and you'll receive an email with a secure link to save your card details.
              </p>
            </div>

            <div className="flex gap-3 pb-8">
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-white text-sm font-medium rounded-lg transition-all hover:brightness-90 disabled:opacity-50"
                style={{ backgroundColor: brand }}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Submitting...' : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
