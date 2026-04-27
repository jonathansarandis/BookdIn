// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Gift, Loader2, X, Copy, Check } from 'lucide-react'

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function GiftCardsPage() {
  const [giftCards, setGiftCards] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    value: '',
    purchased_by: '',
    expires_at: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)

      const [{ data: cards }, { data: custs }] = await Promise.all([
        supabase
          .from('gift_cards')
          .select('*, purchased_by_customer:customers!gift_cards_purchased_by_fkey(full_name), redeemed_by_customer:customers!gift_cards_redeemed_by_fkey(full_name)')
          .eq('business_id', profile?.business_id)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('id, full_name').eq('business_id', profile?.business_id).order('full_name'),
      ])

      setGiftCards(cards || [])
      setCustomers(custs || [])
      setLoading(false)
    }
    load()
  }, [])

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const segments = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    )
    return segments.join('-')
  }

  async function copyCode(code: string, id: string) {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.value) return
    setSaving(true)

    const valueCents = Math.round(parseFloat(form.value) * 100)
    const code = generateCode()

    const { data, error } = await supabase
      .from('gift_cards')
      .insert({
        business_id: businessId,
        code,
        initial_value: valueCents,
        remaining_value: valueCents,
        purchased_by: form.purchased_by || null,
        expires_at: form.expires_at || null,
        is_active: true,
      })
      .select('*, purchased_by_customer:customers!gift_cards_purchased_by_fkey(full_name)')
      .single()

    setSaving(false)
    if (!error && data) {
      setGiftCards(prev => [data, ...prev])
      setShowForm(false)
      setForm({ value: '', purchased_by: '', expires_at: '' })
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('gift_cards').update({ is_active: !current }).eq('id', id)
    setGiftCards(prev => prev.map(g => g.id === id ? { ...g, is_active: !current } : g))
  }

  const totalOutstanding = giftCards.filter(g => g.is_active).reduce((sum, g) => sum + g.remaining_value, 0)
  const totalIssued = giftCards.reduce((sum, g) => sum + g.initial_value, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gift Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">Issue and manage gift cards for your customers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Issue gift card
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total issued</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalIssued)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Outstanding balance</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active cards</p>
          <p className="text-xl font-bold text-gray-900">{giftCards.filter(g => g.is_active).length}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Issue gift card</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Value ($) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    required type="number" min="1" step="0.01"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="50.00"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Purchased by</label>
                <select
                  value={form.purchased_by}
                  onChange={e => setForm(f => ({ ...f, purchased_by: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Expires</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Creating...' : 'Issue gift card'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gift cards list */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : giftCards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No gift cards yet</p>
          <p className="text-sm text-gray-400 mt-1">Issue your first gift card to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Remaining</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Purchased by</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {giftCards.map(card => {
                const isExpired = card.expires_at && new Date(card.expires_at) < new Date()
                const isFullyRedeemed = card.remaining_value === 0
                return (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-900">{card.code}</span>
                        <button onClick={() => copyCode(card.code, card.id)} className="text-gray-400 hover:text-gray-600">
                          {copiedId === card.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Issued {formatDate(card.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(card.initial_value)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${card.remaining_value === 0 ? 'text-gray-400' : 'text-green-700'}`}>
                        {formatCurrency(card.remaining_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{card.purchased_by_customer?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {card.expires_at ? (
                        <span className={isExpired ? 'text-red-500' : ''}>{formatDate(card.expires_at)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(card.id, card.is_active)}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isFullyRedeemed ? 'bg-gray-100 text-gray-500' :
                          isExpired ? 'bg-red-50 text-red-600' :
                          card.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isFullyRedeemed ? 'Redeemed' : isExpired ? 'Expired' : card.is_active ? 'Active' : 'Inactive'}
                        </span>
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
