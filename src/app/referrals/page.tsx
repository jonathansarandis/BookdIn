// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Share2, Loader2, X, CheckCircle2 } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  rewarded:  'bg-blue-50 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    referrer_id: '',
    referred_id: '',
    reward_type: 'discount',
    reward_value: '0',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const [{ data: refs }, { data: custs }] = await Promise.all([
        supabase
          .from('referrals')
          .select('*, referrer:customers!referrals_referrer_id_fkey(id, full_name), referred:customers!referrals_referred_id_fkey(id, full_name)')
          .eq('business_id', profile?.business_id)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('id, full_name').eq('business_id', profile?.business_id).order('full_name'),
      ])

      setReferrals(refs || [])
      setCustomers(custs || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.referrer_id) return
    setSaving(true)

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        business_id: businessId,
        referrer_id: form.referrer_id,
        referred_id: form.referred_id || null,
        status: 'pending',
        reward_type: form.reward_type,
        reward_value: Math.round(parseFloat(form.reward_value || '0') * 100),
        notes: form.notes || null,
      })
      .select('*, referrer:customers!referrals_referrer_id_fkey(id, full_name), referred:customers!referrals_referred_id_fkey(id, full_name)')
      .single()

    setSaving(false)
    if (!error && data) {
      setReferrals(prev => [data, ...prev])
      setShowForm(false)
      setForm({ referrer_id: '', referred_id: '', reward_type: 'discount', reward_value: '0', notes: '' })
    }
  }

  async function updateStatus(id: string, status: string) {
    const updates: any = { status }
    if (status === 'rewarded') updates.reward_issued_at = new Date().toISOString()
    await supabase.from('referrals').update(updates).eq('id', id)
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const totalReferrals = referrals.length
  const completedReferrals = referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length
  const totalRewardsIssued = referrals.filter(r => r.status === 'rewarded').reduce((sum, r) => sum + r.reward_value, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track customer referrals and manage rewards</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add referral
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total referrals</p>
          <p className="text-xl font-bold text-gray-900">{totalReferrals}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Completed</p>
          <p className="text-xl font-bold text-green-700">{completedReferrals}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Rewards issued</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalRewardsIssued)}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Add referral</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Referred by (existing customer) *</label>
                <select
                  required
                  value={form.referrer_id}
                  onChange={e => setForm(f => ({ ...f, referrer_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New customer referred</label>
                <select
                  value={form.referred_id}
                  onChange={e => setForm(f => ({ ...f, referred_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reward type</label>
                <select
                  value={form.reward_type}
                  onChange={e => setForm(f => ({ ...f, reward_type: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="discount">Discount ($)</option>
                  <option value="credit">Account credit ($)</option>
                  <option value="gift_card">Gift card ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reward value ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.reward_value}
                    onChange={e => setForm(f => ({ ...f, reward_value: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Any notes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Adding...' : 'Add referral'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Referrals list */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : referrals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No referrals yet</p>
          <p className="text-sm text-gray-400 mt-1">Track when customers refer friends and family</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Referred by</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">New customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reward</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {referrals.map(ref => (
                <tr key={ref.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ref.referrer?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{ref.referred?.full_name || 'Not yet linked'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ref.reward_value > 0 ? formatCurrency(ref.reward_value) : '—'}
                    {ref.reward_type && ref.reward_value > 0 && (
                      <p className="text-xs text-gray-400 capitalize">{ref.reward_type.replace('_', ' ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(ref.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[ref.status] || 'bg-gray-100 text-gray-500'}`}>
                      {ref.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {ref.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(ref.id, 'completed')}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          Mark complete
                        </button>
                      )}
                      {ref.status === 'completed' && (
                        <button
                          onClick={() => updateStatus(ref.id, 'rewarded')}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Issue reward
                        </button>
                      )}
                      {ref.status === 'rewarded' && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          Rewarded {ref.reward_issued_at ? formatDate(ref.reward_issued_at) : ''}
                        </span>
                      )}
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
