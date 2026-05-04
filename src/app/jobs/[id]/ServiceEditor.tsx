// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, X, Loader2 } from 'lucide-react'
import { calcJobPrice, type RoomPricingRow } from '@/lib/pricing'

interface ServiceEditorProps {
  jobId: string
  businessId: string
  initialService: {
    id: string
    name: string
    base_price: number
    pricing_type: string
    duration_minutes: number
  }
  initialBedrooms: number | null
  initialBathrooms: number | null
  initialExtras: Array<{ id: string; extra_id: string | null; name: string; price: number }>
  isPaid: boolean
  isCancelled: boolean
}

export default function ServiceEditor({
  jobId,
  businessId,
  initialService,
  initialBedrooms,
  initialBathrooms,
  initialExtras,
  isPaid,
  isCancelled,
}: ServiceEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [services, setServices] = useState<any[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState(initialService.id)
  const [roomPricing, setRoomPricing] = useState<RoomPricingRow[]>([])
  const [serviceExtras, setServiceExtras] = useState<any[]>([])
  const [bedrooms, setBedrooms] = useState(initialBedrooms ?? 2)
  const [bathrooms, setBathrooms] = useState(initialBathrooms ?? 1)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>(
    initialExtras.filter(e => e.extra_id).map(e => e.extra_id!)
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLocked = isPaid || isCancelled

  async function fetchServiceData(serviceId: string) {
    const supabase = createClient()
    const [{ data: rp }, { data: se }] = await Promise.all([
      supabase.from('room_pricing').select('*').eq('service_id', serviceId),
      supabase
        .from('service_extras')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_active', true)
        .order('sort_order'),
    ])
    setRoomPricing(rp || [])
    setServiceExtras(se || [])
  }

  async function openModal() {
    if (isLocked) return
    // Reset to current job values on each open
    setSelectedServiceId(initialService.id)
    setBedrooms(initialBedrooms ?? 2)
    setBathrooms(initialBathrooms ?? 1)
    setSelectedExtraIds(initialExtras.filter(e => e.extra_id).map(e => e.extra_id!))
    setError(null)
    setOpen(true)
    setLoading(true)

    const supabase = createClient()
    const [{ data: svcs }, { data: rp }, { data: se }] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, base_price, pricing_type, duration_minutes')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('room_pricing').select('*').eq('service_id', initialService.id),
      supabase
        .from('service_extras')
        .select('*')
        .eq('service_id', initialService.id)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    const svcList = svcs || []
    // Always include the currently-booked service even if it has since been deactivated
    if (!svcList.find(s => s.id === initialService.id)) {
      svcList.unshift({
        id: initialService.id,
        name: initialService.name,
        base_price: initialService.base_price,
        pricing_type: initialService.pricing_type,
        duration_minutes: initialService.duration_minutes,
      })
    }
    setServices(svcList)
    setRoomPricing(rp || [])
    setServiceExtras(se || [])
    setLoading(false)
  }

  async function handleServiceChange(serviceId: string) {
    setSelectedServiceId(serviceId)
    setSelectedExtraIds([])
    setLoading(true)
    await fetchServiceData(serviceId)
    setLoading(false)
  }

  function toggleExtra(id: string) {
    setSelectedExtraIds(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  const selectedService = services.find(s => s.id === selectedServiceId)

  const bedroomCounts = (() => {
    const counts = roomPricing.filter(r => r.type === 'bedroom').map(r => r.count).sort((a, b) => a - b)
    return counts.length > 0 ? counts : [0]
  })()

  const bathroomCounts = (() => {
    const counts = roomPricing.filter(r => r.type === 'bathroom').map(r => r.count).sort((a, b) => a - b)
    return counts.length > 0 ? counts : [0]
  })()

  const priceBreakdown = selectedService
    ? calcJobPrice({
        service: {
          id: selectedService.id,
          base_price: selectedService.base_price,
          pricing_type: selectedService.pricing_type,
          duration_minutes: selectedService.duration_minutes,
        },
        bedrooms,
        bathrooms,
        selectedExtras: serviceExtras
          .filter(e => selectedExtraIds.includes(e.id))
          .map(e => ({ price: e.price })),
        roomPricing,
      })
    : null

  async function handleSave() {
    if (!selectedService || !priceBreakdown) return
    setSaving(true)
    setError(null)
    const supabase = createClient()

    try {
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({
          service_id: selectedService.id,
          price: priceBreakdown.total,
          total_price: priceBreakdown.total,
          duration_minutes: priceBreakdown.durationMinutes,
          bedrooms: selectedService.pricing_type === 'room_based' ? bedrooms : null,
          bathrooms: selectedService.pricing_type === 'room_based' ? bathrooms : null,
        })
        .eq('id', jobId)
      if (jobErr) throw new Error(jobErr.message)

      // Replace extras: delete all then insert selected (sequential — insert depends on delete)
      const { error: delErr } = await supabase
        .from('job_extras')
        .delete()
        .eq('job_id', jobId)
      if (delErr) throw new Error(delErr.message)

      if (selectedExtraIds.length > 0) {
        const toInsert = serviceExtras
          .filter(e => selectedExtraIds.includes(e.id))
          .map(e => ({ job_id: jobId, extra_id: e.id, name: e.name, price: e.price }))
        const { error: insErr } = await supabase.from('job_extras').insert(toInsert)
        if (insErr) throw new Error(insErr.message)
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update service')
    } finally {
      setSaving(false)
    }
  }

  const tooltipText = isPaid
    ? 'Cannot edit — payment collected. Refund the customer first to enable changes.'
    : 'Cannot edit a cancelled booking. Use Rebook to create a new booking from this one.'

  return (
    <>
      {/* Service card — always visible */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Service</h2>
          <div className="relative group">
            <button
              onClick={openModal}
              disabled={isLocked}
              aria-label="Edit service"
              className={`p-1.5 rounded-lg transition-colors ${
                isLocked
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            {isLocked && (
              <div className="absolute right-0 top-8 z-10 w-64 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none leading-snug">
                {tooltipText}
              </div>
            )}
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700">{initialService.name}</p>
        {initialBedrooms != null && (
          <p className="text-sm text-gray-500 mt-1">
            {initialBedrooms} bed · {initialBathrooms ?? 1} bath
          </p>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Edit service</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Service select */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Service</label>
                  <select
                    value={selectedServiceId}
                    onChange={e => handleServiceChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Room pickers — only for room_based services */}
                {selectedService?.pricing_type === 'room_based' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Bedrooms</label>
                      <select
                        value={bedrooms}
                        onChange={e => setBedrooms(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      >
                        {bedroomCounts.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Bathrooms</label>
                      <select
                        value={bathrooms}
                        onChange={e => setBathrooms(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      >
                        {bathroomCounts.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Extras checklist */}
                {serviceExtras.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Add-ons</label>
                    <div className="space-y-2">
                      {serviceExtras.map(extra => (
                        <label
                          key={extra.id}
                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-brand-500"
                              checked={selectedExtraIds.includes(extra.id)}
                              onChange={() => toggleExtra(extra.id)}
                            />
                            <span className="text-sm text-gray-700">{extra.name}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            +${(extra.price / 100).toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live price preview */}
                {priceBreakdown && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Base</span>
                      <span>${(priceBreakdown.base / 100).toFixed(2)}</span>
                    </div>
                    {priceBreakdown.rooms > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Rooms</span>
                        <span>+${(priceBreakdown.rooms / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {priceBreakdown.extras > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Add-ons</span>
                        <span>+${(priceBreakdown.extras / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
                      <span>New total</span>
                      <span>${(priceBreakdown.total / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || loading || !selectedService || !priceBreakdown}
                    className="flex-1 bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
