// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useUTMCapture } from '@/lib/useUTMCapture'

const FREQUENCIES = [
  { value: 'one_time',    label: 'One-time',   discount: 0 },
  { value: 'weekly',      label: 'Weekly',      discount: 10 },
  { value: 'fortnightly', label: 'Fortnightly', discount: 10 },
  { value: 'monthly',     label: 'Monthly',     discount: 10 },
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

  const [form, setForm] = useState({
    service_id: '',
    frequency: 'one_time',
    bedrooms: 1,
    bathrooms: 1,
    scheduled_date: '',
    scheduled_time: '09:00',
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
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, logo_url, brand_color')
        .eq('booking_url_slug', slug)
        .single()

      if (!biz) { setLoading(false); return }
      setBusiness(biz)

      const { data: svcs } = await supabase
        .from('services')
        .select('*, service_extras(*)')
        .eq('business_id', biz.id)
        .eq('is_active', true)
        .order('sort_order')

      setServices(svcs || [])
      if (svcs?.[0]) update('service_id', svcs[0].id)
      setLoading(false)
    }
    load()
  }, [slug])

  // Load room pricing when service changes
  useEffect(() => {
    if (!form.service_id) return
    async function loadRoomPricing() {
      const { data } = await supabase
        .from('room_pricing')
        .select('*')
        .eq('service_id', form.service_id)
      setRoomPricing(data || [])
      setSelectedExtras([])
    }
    loadRoomPricing()
  }, [form.service_id])

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
      ?.filter((ex: any) => selectedExtras.includes(ex.id))
      .reduce((sum: number, ex: any) => sum + ex.price, 0) || 0

    const subtotal = base + extrasTotal
    const discount = selectedFreq.discount > 0 ? Math.round(subtotal * selectedFreq.discount / 100) : 0
    return subtotal - discount
  }

  const totalPrice = calcPrice()

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
          total_price: totalPrice,
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

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">{business.name[0]}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{business.name}</p>
            <p className="text-xs text-gray-500">Online booking</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Book a service</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in your details and we'll confirm your booking shortly.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                ${step >= s ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s ? '✓' : s}
              </div>
              <span className={`text-xs font-medium ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 1 ? 'Service' : s === 2 ? 'Your details' : 'Confirm'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-gray-200 mx-1" />}
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
                  <label key={s.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.service_id === s.id ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="service" value={s.id} checked={form.service_id === s.id}
                        onChange={() => { update('service_id', s.id); setSelectedExtras([]) }}
                        className="w-4 h-4 accent-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">from ${(s.base_price / 100).toFixed(0)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Frequency</h3>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => (
                  <button key={f.value} type="button" onClick={() => update('frequency', f.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${form.frequency === f.value ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`text-xs font-medium ${form.frequency === f.value ? 'text-green-700' : 'text-gray-900'}`}>{f.label}</div>
                    {f.discount > 0 && <div className="text-[10px] text-green-600 mt-0.5">{f.discount}% discount</div>}
                  </button>
                ))}
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

            {selectedService?.service_extras?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Add-ons</h3>
                <div className="space-y-2">
                  {selectedService.service_extras.map((extra: any) => (
                    <label key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <input type="checkbox" checked={selectedExtras.includes(extra.id)}
                          onChange={() => toggleExtra(extra.id)}
                          className="w-4 h-4 accent-green-600 cursor-pointer" />
                        <div>
                          <span className="text-sm text-gray-700">{extra.name}</span>
                          {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">+${(extra.price / 100).toFixed(0)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Preferred date & time</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date *</label>
                  <input type="date" required value={form.scheduled_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => update('scheduled_date', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Time *</label>
                  <select value={form.scheduled_time} onChange={e => update('scheduled_time', e.target.value)} className={inputClass}>
                    {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => (
                      <option key={t} value={t}>{new Date(`2000-01-01T${t}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">Estimated total</span>
                <span className="text-xl font-semibold text-green-700">${(totalPrice / 100).toFixed(2)}</span>
              </div>
              {selectedFreq.discount > 0 && (
                <p className="text-xs text-green-600 mt-1">{selectedFreq.discount}% frequency discount applied</p>
              )}
            </div>

            <button onClick={() => setStep(2)} disabled={!form.service_id || !form.scheduled_date}
              className="w-full py-3 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
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
              <div>
                <label className={labelClass}>Street address *</label>
                <input required value={form.line1} onChange={e => update('line1', e.target.value)}
                  placeholder="123 Main Street" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelClass}>Suburb *</label>
                  <input required value={form.city} onChange={e => update('city', e.target.value)}
                    placeholder="Melbourne" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <select value={form.state} onChange={e => update('state', e.target.value)} className={inputClass}>
                    <option value="">State</option>
                    {['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Postcode *</label>
                  <input required value={form.postcode} onChange={e => update('postcode', e.target.value)}
                    placeholder="3000" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Access instructions (optional)</label>
                <textarea value={form.customer_notes} onChange={e => update('customer_notes', e.target.value)}
                  rows={2} placeholder="Key under mat, gate code, pet at home..."
                  className={`${inputClass} resize-none`} />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
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
                className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
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
                { label: 'Date', value: form.scheduled_date ? new Date(`${form.scheduled_date}T12:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '' },
                { label: 'Time', value: new Date(`2000-01-01T${form.scheduled_time}`).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) },
                ...(selectedService?.pricing_type === 'room_based' ? [
                  { label: 'Bedrooms', value: `${form.bedrooms}` },
                  { label: 'Bathrooms', value: `${form.bathrooms}` },
                ] : []),
                { label: 'Address', value: `${form.line1}, ${form.city} ${form.state} ${form.postcode}` },
                { label: 'Name', value: form.full_name },
                { label: 'Email', value: form.email },
                { label: 'Phone', value: form.phone },
                { label: 'Total', value: `$${(totalPrice / 100).toFixed(2)}`, bold: true },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={`${item.bold ? 'font-semibold text-green-700' : 'text-gray-900'} text-right max-w-xs`}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <strong>Next step:</strong> After confirming, we'll call you to confirm the booking and you'll receive an email with a secure link to save your card details.
              </p>
            </div>

            <div className="flex gap-3 pb-8">
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
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
