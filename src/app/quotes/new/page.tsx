// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'

export default function NewQuotePage() {
  const router = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [extras, setExtras] = useState<any[]>([])
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [businessId, setBusinessId] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  const [form, setForm] = useState({
    customer_id: '',
    service_id: '',
    manual_subtotal: '',
    tax_amount: '',
    valid_until: '',
    notes: '',
  })

  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single()

      setBusinessId(profile?.business_id)

      const [{ data: custs }, { data: svcs }] = await Promise.all([
        supabase.from('customers').select('id, full_name').eq('business_id', profile?.business_id).order('full_name'),
        supabase.from('services').select('*').eq('business_id', profile?.business_id).eq('is_active', true).order('sort_order'),
      ])

      setCustomers(custs || [])
      setServices(svcs || [])
    }
    load()
  }, [])

  useEffect(() => {
    if (!form.service_id) { setExtras([]); setSelectedExtras([]); return }
    async function loadExtras() {
      const { data } = await supabase
        .from('service_extras')
        .select('*')
        .eq('service_id', form.service_id)
        .eq('is_active', true)
        .order('sort_order')
      setExtras(data || [])
      setSelectedExtras([])
    }
    loadExtras()
  }, [form.service_id])

  async function handleCreateCustomer() {
    if (!newCustomer.full_name.trim()) return
    setCreatingCustomer(true)

    const { data, error } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        full_name: newCustomer.full_name.trim(),
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
      })
      .select('id, full_name')
      .single()

    setCreatingCustomer(false)

    if (!error && data) {
      setCustomers(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setForm(prev => ({ ...prev, customer_id: data.id }))
      setNewCustomer({ full_name: '', email: '', phone: '' })
      setShowNewCustomer(false)
    }
  }

  const selectedService = services.find(s => s.id === form.service_id)
  const serviceBasePriceCents = selectedService?.base_price || 0
  const extrasTotalCents = extras.filter(e => selectedExtras.includes(e.id)).reduce((sum, e) => sum + (e.price || 0), 0)
  const subtotalCents = form.service_id
    ? serviceBasePriceCents + extrasTotalCents
    : Math.round(parseFloat(form.manual_subtotal || '0') * 100)
  const taxCents = Math.round(parseFloat(form.tax_amount || '0') * 100)
  const totalCents = subtotalCents + taxCents

  function toggleExtra(id: string) {
    setSelectedExtras(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_id || subtotalCents === 0) return
    setSaving(true)

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        business_id: businessId,
        customer_id: form.customer_id,
        status: 'draft',
        subtotal: subtotalCents,
        tax_amount: taxCents,
        total: totalCents,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
      })
      .select('id')
      .single()

    setSaving(false)
    if (!error && data) router.push(`/quotes/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quotes" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New quote</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Customer */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Customer</h2>

          <select
            value={form.customer_id}
            onChange={e => {
              if (e.target.value === '__new__') {
                setShowNewCustomer(true)
                setForm(prev => ({ ...prev, customer_id: '' }))
              } else {
                setShowNewCustomer(false)
                setForm(prev => ({ ...prev, customer_id: e.target.value }))
              }
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a customer...</option>
            <option value="__new__">+ New customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>

          {/* New customer inline form */}
          {showNewCustomer && (
            <div className="border border-brand-200 bg-brand-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="w-4 h-4 text-brand-600" />
                <p className="text-sm font-medium text-brand-700">New customer details</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full name *</label>
                <input
                  type="text"
                  value={newCustomer.full_name}
                  onChange={e => setNewCustomer(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Jane Smith"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="jane@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="04xx xxx xxx"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={creatingCustomer || !newCustomer.full_name.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {creatingCustomer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {creatingCustomer ? 'Adding...' : 'Add customer'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCustomer(false); setNewCustomer({ full_name: '', email: '', phone: '' }) }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Show selected customer confirmation */}
          {form.customer_id && !showNewCustomer && (
            <p className="text-xs text-green-600 font-medium">
              ✓ {customers.find(c => c.id === form.customer_id)?.full_name}
            </p>
          )}
        </div>

        {/* Service & Add-ons */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Service</h2>
          <select
            value={form.service_id}
            onChange={e => setForm({ ...form, service_id: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a service...</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name} — ${(s.base_price / 100).toFixed(2)}</option>
            ))}
          </select>

          {extras.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Add-ons</p>
              <div className="space-y-2">
                {extras.map(extra => (
                  <label key={extra.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedExtras.includes(extra.id)}
                        onChange={() => toggleExtra(extra.id)}
                        className="w-4 h-4 text-brand-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{extra.name}</p>
                        {extra.description && <p className="text-xs text-gray-500">{extra.description}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">+${(extra.price / 100).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!form.service_id && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Or enter price manually ($)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.manual_subtotal}
                onChange={e => setForm({ ...form, manual_subtotal: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
          )}
        </div>

        {/* Pricing summary */}
        {subtotalCents > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Pricing summary</h2>
            {selectedService && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{selectedService.name}</span>
                <span>${(serviceBasePriceCents / 100).toFixed(2)}</span>
              </div>
            )}
            {extras.filter(e => selectedExtras.includes(e.id)).map(e => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-gray-500">{e.name}</span>
                <span>+${(e.price / 100).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
              <span className="text-gray-500">Subtotal</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Tax ($)</span>
              <input
                type="number" min="0" step="0.01"
                value={form.tax_amount}
                onChange={e => setForm({ ...form, tax_amount: e.target.value })}
                className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valid until</label>
            <input
              type="date" value={form.valid_until}
              onChange={e => setForm({ ...form, valid_until: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              rows={3} value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Any additional details..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !form.customer_id || subtotalCents === 0}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Creating...' : 'Create quote'}
          </button>
          <Link href="/quotes" className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
