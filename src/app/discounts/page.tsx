// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Tag, Loader2, X, Copy, Check } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    min_order: '',
    max_uses: '',
    expires_at: '',
    first_time_only: false,
    service_id: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const [{ data: disc }, { data: svcs }] = await Promise.all([
        supabase.from('discount_codes').select('*, service:services(name)').eq('business_id', profile?.business_id).order('created_at', { ascending: false }),
        supabase.from('services').select('id, name').eq('business_id', profile?.business_id).eq('is_active', true),
      ])

      setDiscounts(disc || [])
      setServices(svcs || [])
      setLoading(false)
    }
    load()
  }, [])

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm(f => ({ ...f, code }))
  }

  async function copyCode(code: string, id: string) {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.value) return
    setSaving(true)

    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        business_id: businessId,
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(form.value),
        min_order: form.min_order ? Math.round(parseFloat(form.min_order) * 100) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
        first_time_only: form.first_time_only,
        service_id: form.service_id || null,
        is_active: true,
        uses_count: 0,
      })
      .select('*, service:services(name)')
      .single()

    setSaving(false)
    if (!error && data) {
      setDiscounts(prev => [data, ...prev])
      setShowForm(false)
      setForm({ code: '', type: 'percentage', value: '', min_order: '', max_uses: '', expires_at: '', first_time_only: false, service_id: '' })
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('discount_codes').update({ is_active: !current }).eq('id', id)
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, is_active: !current } : d))
  }

  async function deleteDiscount(id: string) {
    if (!confirm('Delete this discount code?')) return
    await supabase.from('discount_codes').delete().eq('id', id)
    setDiscounts(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Discounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage discount codes for your customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New discount
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Create discount code</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Code *</label>
                <div className="flex gap-2">
                  <input
                    required
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="SUMMER20"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="button" onClick={generateCode} className="px-3 py-2 text-xs text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {form.type === 'percentage' ? 'Discount %' : 'Discount $'} *
                </label>
                <input
                  required type="number" min="0" step="0.01"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={form.type === 'percentage' ? '20' : '10.00'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min order ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.min_order}
                  onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))}
                  placeholder="0.00"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max uses</label>
                <input
                  type="number" min="1"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Unlimited"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Expires</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Specific service (optional)</label>
                <select
                  value={form.service_id}
                  onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All services</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.first_time_only}
                onChange={e => setForm(f => ({ ...f, first_time_only: e.target.checked }))}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-gray-700">First-time customers only</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Creating...' : 'Create discount'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Discounts list */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : discounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No discount codes yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first discount code to attract customers</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Uses</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discounts.map(discount => {
                const isExpired = discount.expires_at && new Date(discount.expires_at) < new Date()
                return (
                  <tr key={discount.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-900">{discount.code}</span>
                        <button onClick={() => copyCode(discount.code, discount.id)} className="text-gray-400 hover:text-gray-600">
                          {copiedId === discount.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {discount.service?.name && <p className="text-xs text-gray-400 mt-0.5">{discount.service.name} only</p>}
                      {discount.first_time_only && <p className="text-xs text-gray-400 mt-0.5">First-time only</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {discount.type === 'percentage' ? `${discount.value}%` : `$${discount.value}`} off
                      {discount.min_order > 0 && <p className="text-xs text-gray-400">Min ${(discount.min_order / 100).toFixed(0)}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {discount.uses_count || 0}{discount.max_uses ? ` / ${discount.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {discount.expires_at ? (
                        <span className={isExpired ? 'text-red-500' : ''}>{formatDate(discount.expires_at)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(discount.id, discount.is_active)}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          discount.is_active && !isExpired
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isExpired ? 'Expired' : discount.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteDiscount(discount.id)} className="text-xs text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
