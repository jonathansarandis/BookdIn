// @ts-nocheck
'use client'
import PaymentSection from '@/components/payments/PaymentSection'
import ManualSourceSelector from '@/components/ManualSourceSelector'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { calcJobPrice } from '@/lib/pricing'

const FREQUENCIES = [
  { value: 'one_time',    label: 'One-time',         discount: 0 },
  { value: 'weekly',      label: 'Weekly',            discount: 10 },
  { value: 'fortnightly', label: 'Fortnightly',       discount: 10 },
  { value: 'monthly',     label: 'Monthly',           discount: 10 },
]

const TIME_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

export default function BookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preCustomerId = searchParams.get('customer')
  const editJobId = searchParams.get('edit')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [services, setServices] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [form, setForm] = useState({
    service_id: '',
    frequency: 'one_time',
    bedrooms: 2,
    bathrooms: 1,
    scheduled_date: '',
    scheduled_time: '09:00',
    // Customer
    customer_id: preCustomerId || '',
    new_customer: !preCustomerId,
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    // Address
    line1: '',
    city: '',
    state: '',
    postcode: '',
    // Assignment
    provider_id: '',
    notes: '',
  })

  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'other'>('card')
  const [getCardPaymentMethod, setGetCardPaymentMethod] = useState<(() => Promise<string | null>) | null>(null)

  const [leadSource, setLeadSource] = useState('')
  const [campaignLabel, setCampaignLabel] = useState('')
  const [existingCampaigns, setExistingCampaigns] = useState<string[]>([])

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Load reference data (services, customers, providers, campaigns)
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single() as { data: { business_id: string } | null }
      const bid = profile!.business_id!

      const [{ data: svcs }, { data: cxs }, { data: prvs }, { data: campaigns }] = await Promise.all([
        supabase.from('services').select('*, service_extras(*), room_pricing(*)').eq('business_id', bid).eq('is_active', true).order('sort_order'),
        supabase.from('customers').select('id, full_name, email, phone').eq('business_id', bid).order('full_name'),
        supabase.from('providers').select('id, display_name').eq('business_id', bid).eq('is_active', true),
        supabase.from('lead_sources').select('manual_campaign_label').eq('business_id', bid).not('manual_campaign_label', 'is', null),
      ])
      setServices(svcs || [])
      setCustomers(cxs || [])
      setProviders(prvs || [])
      const uniqueCampaigns = [...new Set((campaigns || []).map((r: any) => r.manual_campaign_label).filter(Boolean))]
      setExistingCampaigns(uniqueCampaigns)
      // In edit mode, the prefill useEffect sets service_id from the job — don't override it here
      if (!editJobId && svcs?.[0]) update('service_id', svcs[0].id)
    }
    load()
  }, [])

  // Prefill form from existing job when ?edit= is present
  useEffect(() => {
    if (!editJobId) return
    async function prefill() {
      const supabase = createClient()
      const { data: job } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(id, full_name, email, phone),
          address:addresses(id, line1, city, state, postcode),
          job_extras(id, extra_id, name, price)
        `)
        .eq('id', editJobId)
        .single()
      if (!job) return

      const d = new Date(job.scheduled_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      const scheduledDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const scheduledTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`

      setForm(f => ({
        ...f,
        service_id: job.service_id,
        frequency: job.frequency,
        bedrooms: job.bedrooms ?? 2,
        bathrooms: job.bathrooms ?? 1,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        customer_id: job.customer_id,
        new_customer: false,
        customer_name: job.customer?.full_name || '',
        customer_email: job.customer?.email || '',
        customer_phone: job.customer?.phone || '',
        line1: job.address?.line1 || '',
        city: job.address?.city || '',
        state: job.address?.state || '',
        postcode: job.address?.postcode || '',
        provider_id: job.provider_id || '',
        notes: job.notes || '',
      }))
      setSelectedExtras(
        (job.job_extras || []).filter((e: any) => e.extra_id).map((e: any) => e.extra_id)
      )
    }
    prefill()
  }, [editJobId])

  const selectedService = services.find(s => s.id === form.service_id)
  const selectedFreq = FREQUENCIES.find(f => f.value === form.frequency) ?? FREQUENCIES[0]

  // Derive room counts from room_pricing embedded in the service row
  const bedroomCounts = (() => {
    const counts = (selectedService?.room_pricing || []).filter((r: any) => r.type === 'bedroom').map((r: any) => r.count).sort((a: number, b: number) => a - b)
    return counts.length > 0 ? counts : [1, 2, 3, 4, 5]
  })()

  const bathroomCounts = (() => {
    const counts = (selectedService?.room_pricing || []).filter((r: any) => r.type === 'bathroom').map((r: any) => r.count).sort((a: number, b: number) => a - b)
    return counts.length > 0 ? counts : [1, 2, 3]
  })()

  function calcPrice() {
    if (!selectedService) return 0
    const breakdown = calcJobPrice({
      service: {
        id: selectedService.id,
        base_price: selectedService.base_price,
        pricing_type: selectedService.pricing_type,
        duration_minutes: selectedService.duration_minutes,
      },
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      selectedExtras: (selectedService.service_extras || [])
        .filter((ex: any) => selectedExtras.includes(ex.id))
        .map((ex: any) => ({ price: ex.price })),
      roomPricing: selectedService?.room_pricing || [],
    })
    const discount = selectedFreq.discount > 0 ? Math.round(breakdown.total * selectedFreq.discount / 100) : 0
    return breakdown.total - discount
  }

  const totalPrice = calcPrice()

  function toggleExtra(id: string) {
    setSelectedExtras(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    // Edit save logic — implemented in next commit
    if (editJobId) {
      setError('Edit save not yet implemented.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single() as { data: { business_id: string } | null }
    const bid = profile!.business_id!

    try {
      let customerId = form.customer_id
      let addressId: string

      // Create or use existing customer
      if (form.new_customer || !customerId) {
        const { data: newCx, error: cxErr } = await supabase.from('customers').insert({
          business_id: bid,
          full_name: form.customer_name,
          email: form.customer_email,
          phone: form.customer_phone || null,
        }).select().single()
        if (cxErr) throw new Error('Failed to create customer: ' + cxErr.message)
        customerId = newCx.id
      }

      // Create address
      const { data: addr, error: addrErr } = await supabase.from('addresses').insert({
        business_id: bid,
        customer_id: customerId,
        line1: form.line1,
        city: form.city,
        state: form.state,
        postcode: form.postcode,
        country: 'AU',
        is_default: true,
      }).select().single()
      if (addrErr) throw new Error('Failed to save address: ' + addrErr.message)
      addressId = addr.id

      // Create job
      const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`)
      const { data: job, error: jobErr } = await supabase.from('jobs').insert({
        business_id: bid,
        customer_id: customerId,
        address_id: addressId,
        service_id: form.service_id,
        provider_id: form.provider_id || null,
        status: form.provider_id ? 'assigned' : 'pending',
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService?.duration_minutes || 120,
        price: totalPrice,
      total_price: totalPrice,
        tax_amount: 0,
        frequency: form.frequency,
        notes: form.notes || null,
        booking_source: 'admin',
        bedrooms: selectedService?.pricing_type === 'room_based' ? form.bedrooms : null,
        bathrooms: selectedService?.pricing_type === 'room_based' ? form.bathrooms : null,
      }).select().single()
      if (jobErr) throw new Error('Failed to create job: ' + jobErr.message)

      // Save lead source attribution if selected
      if (leadSource) {
        await fetch('/api/attribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: job.id,
            business_id: bid,
            customer_id: customerId,
            source_type: leadSource,
            manually_entered: true,
            manual_campaign_label: campaignLabel || null,
            booking_value_cents: totalPrice,
          }),
        })
      }

      // Handle card payment - create payment intent with manual capture
      if (paymentMethod === 'card' && getCardPaymentMethod) {
        const paymentMethodId = await getCardPaymentMethod()
        if (!paymentMethodId) throw new Error('Please enter valid card details')
        const intentRes = await fetch('/api/stripe/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id, paymentMethodId }),
        })
        const intentData = await intentRes.json()
        if (intentData.error) throw new Error(intentData.error)
      }

      // Insert extras
      if (selectedExtras.length > 0) {
        const extrasToInsert = selectedService?.service_extras
          .filter((ex: any) => selectedExtras.includes(ex.id))
          .map((ex: any) => ({ job_id: job.id, extra_id: ex.id, name: ex.name, price: ex.price }))
        if (extrasToInsert?.length) await supabase.from('job_extras').insert(extrasToInsert)
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        business_id: bid,
        event_type: 'booking_created',
        description: `New booking created for ${form.new_customer ? form.customer_name : customers.find(c => c.id === customerId)?.full_name}`,
        entity_type: 'job',
        entity_id: job.id,
      })

      // Update customer stats
      await supabase.from('customers').update({
        total_bookings: supabase.rpc as any,
        last_booking_at: new Date().toISOString(),
        lifetime_value: totalPrice,
      }).eq('id', customerId)

      setSuccess(true)
      setTimeout(() => router.push(`/jobs/${job.id}`), 1500)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center animate-fade-in">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking created!</h2>
        <p className="text-gray-500 text-sm">Redirecting to job details...</p>
      </div>
    )
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{editJobId ? 'Edit booking' : 'New booking'}</h2>
        <p className="text-sm text-gray-500">{editJobId ? 'Update the details for this booking' : 'Create a job manually for a customer'}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1,2,3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
              ${step >= s ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > s ? '✓' : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === 1 ? 'Service' : s === 2 ? 'Customer & Address' : 'Review'}
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
            <h3 className="text-sm font-semibold text-gray-900">Service details</h3>
            <div>
              <label className={labelClass}>Service *</label>
              <select value={form.service_id} onChange={e => { update('service_id', e.target.value); setSelectedExtras([]) }} className={inputClass}>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Frequency</label>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => (
                  <button key={f.value} type="button" onClick={() => update('frequency', f.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${form.frequency === f.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`text-xs font-medium ${form.frequency === f.value ? 'text-brand-700' : 'text-gray-900'}`}>{f.label}</div>
                    {f.discount > 0 && <div className="text-[10px] text-green-600 mt-0.5">{f.discount}% discount</div>}
                  </button>
                ))}
              </div>
            </div>

            {selectedService?.pricing_type === 'room_based' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Bedrooms</label>
                  <select value={form.bedrooms} onChange={e => update('bedrooms', parseInt(e.target.value))} className={inputClass}>
                    {bedroomCounts.map(n => <option key={n} value={n}>{n} bedroom{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Bathrooms</label>
                  <select value={form.bathrooms} onChange={e => update('bathrooms', parseInt(e.target.value))} className={inputClass}>
                    {bathroomCounts.map(n => <option key={n} value={n}>{n} bathroom{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Extras */}
          {selectedService?.service_extras?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add-ons</h3>
              <div className="space-y-2">
                {selectedService.service_extras.map((extra: any) => (
                  <label key={extra.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" checked={selectedExtras.includes(extra.id)}
                        onChange={() => toggleExtra(extra.id)}
                        className="w-4 h-4 accent-brand-500 cursor-pointer" />
                      <span className="text-sm text-gray-700">{extra.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">+${(extra.price / 100).toFixed(0)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date & time */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date *</label>
                <input type="date" required value={form.scheduled_date}
                  min={editJobId ? undefined : new Date().toISOString().split('T')[0]}
                  onChange={e => update('scheduled_date', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Time *</label>
                <select value={form.scheduled_time} onChange={e => update('scheduled_time', e.target.value)} className={inputClass}>
                  {/* Render a custom option for times not in the standard slot list (e.g. prefilled from a public booking) */}
                  {!TIME_SLOTS.includes(form.scheduled_time) && form.scheduled_time && (
                    <option value={form.scheduled_time}>
                      {new Date(`2000-01-01T${form.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </option>
                  )}
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Assign provider (optional)</label>
              <select value={form.provider_id} onChange={e => update('provider_id', e.target.value)} className={inputClass}>
                <option value="">Unassigned — assign later</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
          </div>

          {/* Price preview */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-brand-700 font-medium">Estimated total</span>
              <span className="text-xl font-semibold text-brand-700">${(totalPrice / 100).toFixed(2)}</span>
            </div>
            {selectedFreq.discount > 0 && (
              <p className="text-xs text-brand-600 mt-1">{selectedFreq.discount}% frequency discount applied</p>
            )}
          </div>

          <button onClick={() => setStep(2)} disabled={!form.service_id || !form.scheduled_date}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Customer & Address */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Customer</h3>

            {editJobId ? (
              // Edit mode: show fields directly, no customer-switching dropdown
              <>
                <p className="text-xs text-gray-400">Changes here update this customer's profile across all their bookings.</p>
                <div>
                  <label className={labelClass}>Full name *</label>
                  <input required value={form.customer_name} onChange={e => update('customer_name', e.target.value)}
                    placeholder="Jane Smith" className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email *</label>
                    <input required type="email" value={form.customer_email} onChange={e => update('customer_email', e.target.value)}
                      placeholder="jane@email.com" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)}
                      placeholder="+61 4xx xxx xxx" className={inputClass} />
                  </div>
                </div>
              </>
            ) : (
              // Create mode: existing-customer dropdown + new-customer fields
              <>
                {customers.length > 0 && (
                  <div>
                    <label className={labelClass}>Existing customer</label>
                    <select value={form.customer_id}
                      onChange={e => { update('customer_id', e.target.value); update('new_customer', !e.target.value) }}
                      className={inputClass}>
                      <option value="">+ New customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.email}</option>)}
                    </select>
                  </div>
                )}
                {(!form.customer_id || form.new_customer) && (
                  <>
                    <div>
                      <label className={labelClass}>Full name *</label>
                      <input required value={form.customer_name} onChange={e => update('customer_name', e.target.value)}
                        placeholder="Jane Smith" className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Email *</label>
                        <input required type="email" value={form.customer_email} onChange={e => update('customer_email', e.target.value)}
                          placeholder="jane@email.com" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Phone</label>
                        <input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)}
                          placeholder="+61 4xx xxx xxx" className={inputClass} />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
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
                <label className={labelClass}>City *</label>
                <input required value={form.city} onChange={e => update('city', e.target.value)}
                  placeholder="Melbourne" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>State *</label>
                <input required value={form.state} onChange={e => update('state', e.target.value)}
                  placeholder="VIC" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Postcode *</label>
                <input required value={form.postcode} onChange={e => update('postcode', e.target.value)}
                  placeholder="3000" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
                rows={2} placeholder="Staff notes, access instructions, anything relevant..."
                className={`${inputClass} resize-none`} />
            </div>
          </div>

          {/* Lead source — create mode only; attribution is captured once at booking creation */}
          {!editJobId && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead source</h3>
              <ManualSourceSelector
                value={leadSource}
                onChange={setLeadSource}
                campaignLabel={campaignLabel}
                onCampaignLabelChange={setCampaignLabel}
                campaigns={existingCampaigns}
              />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button onClick={() => setStep(3)}
              disabled={
                !form.line1 || !form.city || !form.state || !form.postcode ||
                (editJobId
                  ? !form.customer_name || !form.customer_email
                  : form.new_customer && (!form.customer_name || !form.customer_email))
              }
              className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              Review booking →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Booking summary</h3>
            {[
              { label: 'Service', value: selectedService?.name },
              { label: 'Frequency', value: selectedFreq.label },
              { label: 'Date & time', value: form.scheduled_date ? `${new Date(form.scheduled_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date(`2000-01-01T${form.scheduled_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : '—' },
              { label: 'Address', value: `${form.line1}, ${form.city} ${form.state} ${form.postcode}` },
              { label: 'Customer', value: editJobId ? form.customer_name : (form.customer_id && !form.new_customer ? customers.find(c => c.id === form.customer_id)?.full_name : form.customer_name) },
              { label: 'Total', value: `$${(totalPrice / 100).toFixed(2)}`, bold: true },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{item.label}</span>
                <span className={`${item.bold ? 'font-semibold text-brand-600' : 'text-gray-900'} text-right max-w-xs`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Payment section — create mode only */}
          {!editJobId && (
            <PaymentSection
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              onCardReady={(fn) => setGetCardPaymentMethod(() => fn)}
            />
          )}

          <div className="flex gap-3 pb-8">
            <button onClick={() => setStep(2)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading
                ? (editJobId ? 'Saving...' : 'Creating booking...')
                : (editJobId ? 'Save changes' : 'Confirm booking')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
