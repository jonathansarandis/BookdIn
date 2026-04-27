// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Plus, Pause, Play, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function RecurringPage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    customer_id: '',
    service_id: '',
    provider_id: '',
    frequency: 'fortnightly',
    next_scheduled_at: '',
    price: '',
    auto_charge: true,
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const [{ data: scheds }, { data: custs }, { data: svcs }, { data: prvs }] = await Promise.all([
        supabase.from('recurring_schedules').select('*, customer:customers(full_name), service:services(name), provider:providers(display_name)').eq('business_id', profile?.business_id).order('next_scheduled_at'),
        supabase.from('customers').select('id, full_name').eq('business_id', profile?.business_id).order('full_name'),
        supabase.from('services').select('id, name, base_price').eq('business_id', profile?.business_id).eq('is_active', true),
        supabase.from('providers').select('id, display_name').eq('business_id', profile?.business_id).eq('is_active', true),
      ])

      setSchedules(scheds || [])
      setCustomers(custs || [])
      setServices(svcs || [])
      setProviders(prvs || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_id || !form.service_id || !form.next_scheduled_at) return
    setSaving(true)

    const selectedService = services.find(s => s.id === form.service_id)
    const price = form.price ? Math.round(parseFloat(form.price) * 100) : selectedService?.base_price || 0

    const { data, error } = await supabase
      .from('recurring_schedules')
      .insert({
        business_id: businessId,
        customer_id: form.customer_id,
        service_id: form.service_id,
        provider_id: form.provider_id || null,
        frequency: form.frequency,
        next_scheduled_at: new Date(form.next_scheduled_at).toISOString(),
        is_active: true,
        price,
        auto_charge: form.auto_charge,
        notes: form.notes || null,
      })
      .select('*, customer:customers(full_name), service:services(name), provider:providers(display_name)')
      .single()

    setSaving(false)
    if (!error && data) {
      setSchedules(prev => [...prev, data])
      setShowForm(false)
      setForm({ customer_id: '', service_id: '', provider_id: '', frequency: 'fortnightly', next_scheduled_at: '', price: '', auto_charge: true, notes: '' })
    }
  }

  async function togglePause(id: string, isActive: boolean) {
    await supabase.from('recurring_schedules').update({ is_active: !isActive }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !isActive } : s))
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Cancel this recurring schedule?')) return
    await supabase.from('recurring_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  const activeCount = schedules.filter(s => s.is_active).length
  const monthlyRevenue = schedules.filter(s => s.is_active).reduce((sum, s) => {
    const multiplier = s.frequency === 'weekly' ? 4 : s.frequency === 'fortnightly' ? 2 : 1
    return sum + (s.price || 0) * multiplier
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recurring Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage scheduled recurring services</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add schedule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active schedules</p>
          <p className="text-xl font-bold text-gray-900">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Est. monthly revenue</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(monthlyRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total schedules</p>
          <p className="text-xl font-bold text-gray-900">{schedules.length}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">New recurring schedule</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer *</label>
                <select required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service *</label>
                <select required value={form.service_id} onChange={e => {
                  const svc = services.find(s => s.id === e.target.value)
                  setForm(f => ({ ...f, service_id: e.target.value, price: svc ? (svc.base_price / 100).toFixed(2) : '' }))
                }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select service...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Frequency *</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">First/next date *</label>
                <input required type="datetime-local" value={form.next_scheduled_at}
                  onChange={e => setForm(f => ({ ...f, next_scheduled_at: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assign provider</label>
                <select value={form.provider_id} onChange={e => setForm(f => ({ ...f, provider_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Unassigned</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.auto_charge} onChange={e => setForm(f => ({ ...f, auto_charge: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-gray-700">Auto-charge card when job is complete</span>
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : 'Create schedule'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Schedules list */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No recurring schedules yet</p>
          <p className="text-sm text-gray-400 mt-1">Set up recurring jobs for your regular customers</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Next job</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map(schedule => (
                <tr key={schedule.id} className={`hover:bg-gray-50 ${!schedule.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{schedule.customer?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{schedule.service?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{FREQ_LABELS[schedule.frequency] || schedule.frequency}</td>
                  <td className="px-4 py-3 text-gray-600">{schedule.next_scheduled_at ? formatDate(schedule.next_scheduled_at) : '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{formatCurrency(schedule.price || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${schedule.is_active ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => togglePause(schedule.id, schedule.is_active)}
                        className="p-1 text-gray-400 hover:text-gray-600" title={schedule.is_active ? 'Pause' : 'Resume'}>
                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteSchedule(schedule.id)}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
