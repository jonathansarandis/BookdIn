// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

const PRICING_TYPES = [
  { value: 'flat',       label: 'Flat rate',    desc: 'One fixed price' },
  { value: 'room_based', label: 'Room-based',   desc: 'Price based on bedrooms/bathrooms' },
  { value: 'hourly',     label: 'Hourly',       desc: 'Charge per hour' },
  { value: 'sqft_based', label: 'Per sq ft',    desc: 'Based on property size' },
]

interface Extra { id?: string; name: string; price: string; duration: string }
interface RoomPrice { count: number; price: string }

export default function EditServicePage() {
  const router = useRouter()
  const params = useParams()
  const serviceId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [extras, setExtras] = useState<Extra[]>([])
  const [businessId, setBusinessId] = useState('')
  const [deletedExtraIds, setDeletedExtraIds] = useState<string[]>([])

  const [bedroomPrices, setBedroomPrices] = useState<RoomPrice[]>([
    { count: 1, price: '0' },
    { count: 2, price: '0' },
    { count: 3, price: '0' },
    { count: 4, price: '0' },
    { count: 5, price: '0' },
  ])

  const [bathroomPrices, setBathroomPrices] = useState<RoomPrice[]>([
    { count: 1, price: '0' },
    { count: 2, price: '0' },
    { count: 3, price: '0' },
  ])

  const [form, setForm] = useState({
    name: '',
    description: '',
    pricing_type: 'flat',
    base_price: '',
    duration_minutes: '120',
    same_day_fee: '0',
    weekend_fee: '0',
    travel_fee: '0',
    is_active: true,
  })

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const { data: service } = await supabase
        .from('services')
        .select('*, service_extras(*)')
        .eq('id', serviceId)
        .single()

      if (!service) { router.push('/services'); return }

      setForm({
        name: service.name,
        description: service.description || '',
        pricing_type: service.pricing_type,
        base_price: (service.base_price / 100).toFixed(2),
        duration_minutes: service.duration_minutes.toString(),
        same_day_fee: ((service.same_day_fee || 0) / 100).toFixed(2),
        weekend_fee: ((service.weekend_fee || 0) / 100).toFixed(2),
        travel_fee: ((service.travel_fee || 0) / 100).toFixed(2),
        is_active: service.is_active,
      })

      setExtras(service.service_extras?.map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        price: (ex.price / 100).toFixed(2),
        duration: ex.duration_minutes?.toString() || '0',
      })) || [])

      // Load room pricing
      const { data: roomPricing } = await supabase
        .from('room_pricing')
        .select('*')
        .eq('service_id', serviceId)

      if (roomPricing?.length) {
        const beds = roomPricing.filter(r => r.type === 'bedroom').sort((a, b) => a.count - b.count)
        const baths = roomPricing.filter(r => r.type === 'bathroom').sort((a, b) => a.count - b.count)
        if (beds.length) setBedroomPrices(beds.map(b => ({ count: b.count, price: (b.price / 100).toFixed(2) })))
        if (baths.length) setBathroomPrices(baths.map(b => ({ count: b.count, price: (b.price / 100).toFixed(2) })))
      }

      setFetching(false)
    }
    load()
  }, [serviceId])

  function addExtra() { setExtras(e => [...e, { name: '', price: '', duration: '0' }]) }

  function updateExtra(i: number, field: string, value: string) {
    setExtras(e => e.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex))
  }

  function removeExtra(i: number) {
    const extra = extras[i]
    if (extra.id) setDeletedExtraIds(ids => [...ids, extra.id!])
    setExtras(e => e.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Update service
      const { error: svcError } = await supabase
        .from('services')
        .update({
          name: form.name,
          description: form.description || null,
          pricing_type: form.pricing_type,
          base_price: Math.round(parseFloat(form.base_price) * 100),
          duration_minutes: parseInt(form.duration_minutes),
          same_day_fee: Math.round(parseFloat(form.same_day_fee || '0') * 100),
          weekend_fee: Math.round(parseFloat(form.weekend_fee || '0') * 100),
          travel_fee: Math.round(parseFloat(form.travel_fee || '0') * 100),
          is_active: form.is_active,
        })
        .eq('id', serviceId)

      if (svcError) throw new Error(svcError.message)

      // Delete removed extras
      if (deletedExtraIds.length > 0) {
        await supabase.from('service_extras').delete().in('id', deletedExtraIds)
      }

      // Upsert extras
      const validExtras = extras.filter(ex => ex.name && ex.price)
      for (let i = 0; i < validExtras.length; i++) {
        const ex = validExtras[i]
        if (ex.id) {
          await supabase.from('service_extras').update({
            name: ex.name,
            price: Math.round(parseFloat(ex.price) * 100),
            duration_minutes: parseInt(ex.duration || '0'),
            sort_order: i,
          }).eq('id', ex.id)
        } else {
          await supabase.from('service_extras').insert({
            service_id: serviceId,
            business_id: businessId,
            name: ex.name,
            price: Math.round(parseFloat(ex.price) * 100),
            duration_minutes: parseInt(ex.duration || '0'),
            sort_order: i,
            is_active: true,
          })
        }
      }

      // Save room pricing via API route (uses service role to bypass RLS)
      if (form.pricing_type === 'room_based') {
        const res = await fetch(`/api/services/${serviceId}/room-pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bedroomPrices, bathroomPrices }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to save room pricing')
      }

      router.push('/services')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/services" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Edit service</h2>
          <p className="text-sm text-gray-500">{form.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {/* Basic info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Basic info</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">Active</span>
              <div
                onClick={() => update('is_active', !form.is_active)}
                className={`w-9 h-5 rounded-full transition-colors ${form.is_active ? 'bg-brand-500' : 'bg-gray-300'} relative cursor-pointer`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Service name *</label>
            <input required value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. General Clean, Deep Clean, End of Lease"
              className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)}
              rows={2} placeholder="What's included in this service..."
              className={`${inputClass} resize-none`} />
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Pricing</h3>
          <div className="grid grid-cols-2 gap-2">
            {PRICING_TYPES.map(pt => (
              <button key={pt.value} type="button" onClick={() => update('pricing_type', pt.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${form.pricing_type === pt.value
                  ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`text-xs font-medium ${form.pricing_type === pt.value ? 'text-brand-700' : 'text-gray-900'}`}>{pt.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{pt.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {form.pricing_type === 'room_based' ? 'Base price (1 bed / 1 bath)' : 'Base price'} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input required type="number" min="0" step="0.01" value={form.base_price}
                  onChange={e => update('base_price', e.target.value)} placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration (minutes) *</label>
              <input required type="number" min="15" step="15" value={form.duration_minutes}
                onChange={e => update('duration_minutes', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Room-based pricing */}
          {form.pricing_type === 'room_based' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">Set the additional price added for each bedroom/bathroom count. Base price = 1 bed / 1 bath.</p>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Bedroom pricing (additional cost)</p>
                <div className="space-y-2">
                  {bedroomPrices.map((bp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24 flex-shrink-0">{bp.count} bedroom{bp.count > 1 ? 's' : ''}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={bp.price}
                          onChange={e => setBedroomPrices(prev => prev.map((p, idx) => idx === i ? { ...p, price: e.target.value } : p))}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Bathroom pricing (additional cost)</p>
                <div className="space-y-2">
                  {bathroomPrices.map((bp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24 flex-shrink-0">{bp.count} bathroom{bp.count > 1 ? 's' : ''}</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={bp.price}
                          onChange={e => setBathroomPrices(prev => prev.map((p, idx) => idx === i ? { ...p, price: e.target.value } : p))}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { field: 'same_day_fee', label: 'Same-day fee' },
              { field: 'weekend_fee',  label: 'Weekend fee' },
              { field: 'travel_fee',   label: 'Travel fee' },
            ].map(f => (
              <div key={f.field}>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form[f.field as keyof typeof form] as string}
                    onChange={e => update(f.field, e.target.value)} placeholder="0"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extras */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Add-ons & extras</h3>
            <button type="button" onClick={addExtra}
              className="flex items-center gap-1.5 text-xs text-brand-600 font-medium hover:text-brand-700">
              <Plus className="w-3.5 h-3.5" /> Add extra
            </button>
          </div>
          {extras.length === 0 && (
            <p className="text-xs text-gray-400">No add-ons — e.g. Oven clean, Carpet steam, Interior windows</p>
          )}
          {extras.map((extra, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <input value={extra.name} onChange={e => updateExtra(i, 'name', e.target.value)}
                  placeholder="Extra name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={extra.price}
                  onChange={e => updateExtra(i, 'price', e.target.value)} placeholder="0.00"
                  className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-2">
                <input type="number" min="0" step="5" value={extra.duration}
                  onChange={e => updateExtra(i, 'duration', e.target.value)} placeholder="min"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button type="button" onClick={() => removeExtra(i)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pb-8">
          <Link href="/services"
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
