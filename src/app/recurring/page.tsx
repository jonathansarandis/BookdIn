// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Plus, Pause, Play, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

const CANCELLABLE_STATUSES = '("completed","cancelled")'

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
  const [locationServices, setLocationServices] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [filterLocationId, setFilterLocationId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [businessId, setBusinessId] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    location_id: '',
    customer_id: '',
    service_id: '',
    provider_id: '',
    frequency: 'fortnightly',
    next_scheduled_at: '',
    price: '',
    auto_charge: true,
    notes: '',
  })

  const filteredServicesForForm = locationServices
    .filter((ls: any) => ls.location_id === form.location_id)
    .map((ls: any) => ({
      id: ls.services.id,
      name: ls.services.name,
      base_price: ls.base_price,
    }))

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const [{ data: scheds }, { data: custs }, { data: locSvcs }, { data: prvs }, { data: locs }] = await Promise.all([
        supabase.from('recurring_schedules').select('*, customer:customers(full_name), service:services(name), provider:providers(display_name), location:locations(id, name)').eq('business_id', profile?.business_id).order('next_scheduled_at'),
        supabase.from('customers').select('id, full_name').eq('business_id', profile?.business_id).order('full_name'),
        supabase.from('location_services').select('location_id, base_price, is_enabled, services!inner(id, name, business_id, is_active)').eq('services.business_id', profile?.business_id).eq('is_enabled', true).eq('services.is_active', true),
        supabase.from('providers').select('id, display_name').eq('business_id', profile?.business_id).eq('is_active', true),
        supabase.from('locations').select('id, name').eq('business_id', profile?.business_id).eq('is_active', true).order('name'),
      ])

      setSchedules(scheds || [])
      setCustomers(custs || [])
      setLocationServices(locSvcs || [])
      setProviders(prvs || [])
      setLocations(locs || [])
      if (locs && locs.length > 0) {
        setForm(f => ({ ...f, location_id: locs[0].id }))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer_id || !form.service_id || !form.next_scheduled_at || !form.location_id) return
    setSaving(true)

    const selectedService = filteredServicesForForm.find(s => s.id === form.service_id)
    const price = form.price ? Math.round(parseFloat(form.price) * 100) : selectedService?.base_price || 0

    const { data, error } = await supabase
      .from('recurring_schedules')
      .insert({
        business_id: businessId,
        location_id: form.location_id,
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
      .select('*, customer:customers(full_name), service:services(name), provider:providers(display_name), location:locations(id, name)')
      .single()

    setSaving(false)
    if (!error && data) {
      setSchedules(prev => [...prev, data])
      setShowForm(false)
      setForm({ location_id: locations[0]?.id || '', customer_id: '', service_id: '', provider_id: '', frequency: 'fortnightly', next_scheduled_at: '', price: '', auto_charge: true, notes: '' })
    }
  }

  // Materializes upcoming occurrences for every active schedule right now, instead of
  // waiting for the next 8am cron run — useful right after creating/editing a schedule, or
  // just to confirm a fix took effect without waiting on the clock.
  async function syncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/recurring/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      const { data: scheds } = await supabase
        .from('recurring_schedules')
        .select('*, customer:customers(full_name), service:services(name), provider:providers(display_name), location:locations(id, name)')
        .eq('business_id', businessId)
        .order('next_scheduled_at')
      setSchedules(scheds || [])

      alert(data.jobs_created > 0
        ? `Synced — created ${data.jobs_created} upcoming booking${data.jobs_created === 1 ? '' : 's'} across ${data.schedules_checked} schedule${data.schedules_checked === 1 ? '' : 's'}.`
        : `Synced — everything was already up to date across ${data.schedules_checked} schedule${data.schedules_checked === 1 ? '' : 's'}.`)
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  async function togglePause(id: string, isActive: boolean) {
    await supabase.from('recurring_schedules').update({ is_active: !isActive }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !isActive } : s))
  }

  // Cancels the schedule AND every future, not-yet-completed booking already generated from
  // it — the one-click "client cancelled/rescheduled" action. Matches on recurring_schedule_id
  // for jobs the cron created after that link was added, and falls back to customer+service
  // for older jobs created before the link existed, so nothing already on the calendar is
  // left behind. Only ever touches future, non-terminal jobs — past/completed jobs and
  // payment records are untouched.
  async function deleteSchedule(schedule: any) {
    const name = schedule.customer?.full_name || 'this customer'
    if (!confirm(`Cancel the recurring schedule for ${name}? This will also cancel every upcoming booking already on the calendar for them. Past and completed bookings are not affected. This can't be undone.`)) return

    setCancelling(schedule.id)
    const nowIso = new Date().toISOString()

    const { data: cancelledJobs, error: cancelError } = await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .or(`recurring_schedule_id.eq.${schedule.id},and(customer_id.eq.${schedule.customer_id},service_id.eq.${schedule.service_id},recurring_schedule_id.is.null)`)
      .gte('scheduled_at', nowIso)
      .not('status', 'in', CANCELLABLE_STATUSES)
      .select('id')

    if (cancelError) {
      setCancelling(null)
      alert(`Couldn't cancel the upcoming bookings: ${cancelError.message}. The schedule itself was not cancelled either — nothing was changed.`)
      return
    }

    const { error: deleteError } = await supabase.from('recurring_schedules').delete().eq('id', schedule.id)
    setCancelling(null)
    if (deleteError) {
      alert(`Cancelled ${cancelledJobs?.length || 0} upcoming booking(s), but couldn't remove the schedule itself: ${deleteError.message}`)
      return
    }

    setSchedules(prev => prev.filter(s => s.id !== schedule.id))
    alert(`Cancelled the recurring schedule for ${name} and ${cancelledJobs?.length || 0} upcoming booking(s).`)
  }

  const activeCount = schedules.filter(s => s.is_active).length
  const monthlyRevenue = schedules.filter(s => s.is_active).reduce((sum, s) => {
    const multiplier = s.frequency === 'weekly' ? 4 : s.frequency === 'fortnightly' ? 2 : 1
    return sum + (s.price || 0) * multiplier
  }, 0)

  const visibleSchedules = schedules.filter(s => !filterLocationId || s.location_id === filterLocationId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recurring Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage scheduled recurring services</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            title="Materialize upcoming bookings for every active schedule now, instead of waiting for the next automatic run"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add schedule
          </button>
        </div>
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
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Location *</label>
                <select required value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value, service_id: '', price: '' }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
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
                  const svc = filteredServicesForForm.find(s => s.id === e.target.value)
                  setForm(f => ({ ...f, service_id: e.target.value, price: svc ? (svc.base_price / 100).toFixed(2) : '' }))
                }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select service...</option>
                  {filteredServicesForForm.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
      {locations.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter by location:</span>
          <select
            value={filterLocationId}
            onChange={e => setFilterLocationId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : visibleSchedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No recurring schedules yet</p>
          <p className="text-sm text-gray-400 mt-1">Set up recurring bookings for your regular customers</p>
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
              {visibleSchedules.map(schedule => (
                <tr key={schedule.id} className={`hover:bg-gray-50 ${!schedule.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{schedule.customer?.full_name || '—'}</span>
                      {schedule.location?.name && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {schedule.location.name.slice(0, 3)}
                        </span>
                      )}
                    </div>
                  </td>
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
                        disabled={cancelling === schedule.id}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40" title={schedule.is_active ? 'Pause' : 'Resume'}>
                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteSchedule(schedule)}
                        disabled={cancelling === schedule.id}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40"
                        title="Cancel schedule + all upcoming bookings">
                        {cancelling === schedule.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
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
