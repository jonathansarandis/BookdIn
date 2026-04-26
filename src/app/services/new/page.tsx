'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'

const PRICING_TYPES = [
  { value: 'flat',       label: 'Flat rate',    desc: 'One fixed price' },
  { value: 'room_based', label: 'Room-based',   desc: 'Price based on bedrooms/bathrooms' },
  { value: 'hourly',     label: 'Hourly',       desc: 'Charge per hour' },
  { value: 'sqft_based', label: 'Per sq ft',    desc: 'Based on property size' },
]

interface Extra { name: string; price: string; duration: string }

export default function NewServicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extras, setExtras] = useState<Extra[]>([])

  const [form, setForm] = useState({
    name: '',
    description: '',
    pricing_type: 'flat',
    base_price: '',
    duration_minutes: '120',
    same_day_fee: '0',
    weekend_fee: '0',
    travel_fee: '0',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addExtra() {
    setExtras(e => [...e, { name: '', price: '', duration: '0' }])
  }

  function updateExtra(i: number, field: string, value: string) {
    setExtras(e => e.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex))
  }

  function removeExtra(i: number) {
    setExtras(e => e.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

    const { data: service, error: svcError } = await supabase
      .from('services')
      .insert({
        business_id: profile!.business_id!,
        name: form.name,
        description: form.description || null,
        pricing_type: form.pricing_type,
        base_price: Math.round(parseFloat(form.base_price) * 100),
        duration_minutes: parseInt(form.duration_minutes),
        same_day_fee: Math.round(parseFloat(form.same_day_fee || '0') * 100),
        weekend_fee: Math.round(parseFloat(form.weekend_fee || '0') * 100),
        travel_fee: Math.round(parseFloat(form.travel_fee || '0') * 100),
        is_active: true,
      })
      .select()
      .single()

    if (svcError || !service) {
      setError(svcError?.message || 'Failed to create service')
      setLoading(false)
      return
    }

    // Insert extras
    if (extras.length > 0) {
      const validExtras = extras.filter(ex => ex.name && ex.price)
      if (validExtras.length > 0) {
        await supabase.from('service_extras').insert(
          validExtras.map((ex, i) => ({
            service_id: service.id,
            business_id: profile!.business_id!,
            name: ex.name,
            price: Math.round(parseFloat(ex.price) * 100),
            duration_minutes: parseInt(ex.duration || '0'),
            sort_order: i,
          }))
        )
      }
    }

    router.push('/services')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Add new service</h2>
          <p className="text-sm text-gray-500">Set up pricing and duration for this service</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {/* Basic info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Basic info</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Service name *</label>
            <input required value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="e.g. Standard Clean, Deep Clean, Move-out Clean"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)}
              rows={2} placeholder="What's included in this service..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Pricing</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Pricing type *</label>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {form.pricing_type === 'room_based' ? 'Base price (1 bed / 1 bath)' : 'Base price'} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input required type="number" min="0" step="0.01" value={form.base_price}
                  onChange={e => update('base_price', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration (minutes) *</label>
              <input required type="number" min="15" step="15" value={form.duration_minutes}
                onChange={e => update('duration_minutes', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
            </div>
          </div>
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
                  <input type="number" min="0" step="0.01" value={form[f.field as keyof typeof form]}
                    onChange={e => update(f.field, e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Extras / Add-ons */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Add-ons & extras</h3>
            <button type="button" onClick={addExtra}
              className="flex items-center gap-1.5 text-xs text-brand-600 font-medium hover:text-brand-700">
              <Plus className="w-3.5 h-3.5" /> Add extra
            </button>
          </div>
          {extras.length === 0 && (
            <p className="text-xs text-gray-400">No add-ons yet — e.g. Oven clean, Fridge clean, Interior windows</p>
          )}
          {extras.map((extra, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <input value={extra.name} onChange={e => updateExtra(i, 'name', e.target.value)}
                  placeholder="Extra name (e.g. Oven clean)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              </div>
              <div className="col-span-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={extra.price}
                  onChange={e => updateExtra(i, 'price', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
              </div>
              <div className="col-span-2">
                <input type="number" min="0" step="5" value={extra.duration}
                  onChange={e => updateExtra(i, 'duration', e.target.value)}
                  placeholder="min"
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
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
          <button type="button" onClick={() => router.back()}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save service'}
          </button>
        </div>
      </form>
    </div>
  )
}
