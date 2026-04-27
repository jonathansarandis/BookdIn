// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewQuotePage() {
  const router = useRouter()
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    subtotal: '',
    tax_amount: '',
    valid_until: '',
    notes: '',
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
        supabase.from('services').select('id, name, base_price').eq('business_id', profile?.business_id).order('name'),
      ])

      setCustomers(custs || [])
      setServices(svcs || [])
    }
    load()
  }, [])

  const subtotalCents = Math.round(parseFloat(form.subtotal || '0') * 100)
  const taxCents = Math.round(parseFloat(form.tax_amount || '0') * 100)
  const totalCents = subtotalCents + taxCents

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
    if (!error && data) {
      router.push(`/quotes/${data.id}`)
    }
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Customer *</label>
            <select
              required
              value={form.customer_id}
              onChange={e => setForm({ ...form, customer_id: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Subtotal ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.subtotal}
                onChange={e => setForm({ ...form, subtotal: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tax ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax_amount}
                onChange={e => setForm({ ...form, tax_amount: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
          </div>
          {subtotalCents > 0 && (
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valid until</label>
            <input
              type="date"
              value={form.valid_until}
              onChange={e => setForm({ ...form, valid_until: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
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
