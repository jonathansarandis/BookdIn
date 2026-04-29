// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Users, Loader2, X, Phone, Mail, Pencil, Trash2, Send, CheckCircle2 } from 'lucide-react'

const COLORS = ['#2563FF', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0e7490', '#4338ca', '#be123c']

export default function ProvidersPage() {
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    display_name: '', email: '', phone: '', color: COLORS[0], notes: '', accept_jobs: true, is_active: true,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      setBusinessId(profile?.business_id)
      const { data } = await supabase.from('providers').select('*').eq('business_id', profile?.business_id).order('created_at')
      setProviders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function resetForm() {
    setForm({ display_name: '', email: '', phone: '', color: COLORS[0], notes: '', accept_jobs: true, is_active: true })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(provider: any) {
    setForm({ display_name: provider.display_name, email: provider.email || '', phone: provider.phone || '', color: provider.color || COLORS[0], notes: provider.notes || '', accept_jobs: provider.accept_jobs, is_active: provider.is_active })
    setEditingId(provider.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.display_name.trim()) return
    setSaving(true)
    const payload = { business_id: businessId, display_name: form.display_name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, color: form.color, notes: form.notes.trim() || null, accept_jobs: form.accept_jobs, is_active: form.is_active }
    if (editingId) {
      const { data } = await supabase.from('providers').update(payload).eq('id', editingId).select().single()
      if (data) setProviders(prev => prev.map(p => p.id === editingId ? data : p))
    } else {
      const { data } = await supabase.from('providers').insert(payload).select().single()
      if (data) setProviders(prev => [...prev, data])
    }
    setSaving(false)
    resetForm()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    const { error } = await supabase.from('providers').delete().eq('id', id)
    if (!error) setProviders(prev => prev.filter(p => p.id !== id))
  }

  async function handleInvite(provider: any) {
    if (!provider.email) { alert('Please add an email address first.'); return }
    setInviting(provider.id)
    const res = await fetch('/api/providers/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: provider.id }),
    })
    const data = await res.json()
    setInviting(null)
    if (res.ok) {
      setInviteSuccess(provider.id)
      setTimeout(() => setInviteSuccess(null), 3000)
    } else {
      alert(data.error || 'Failed to send invite')
    }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('providers').update({ is_active: !current }).eq('id', id)
    setProviders(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Providers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your staff and service providers</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#2563FF' }}>
          <Plus className="w-4 h-4" /> Add provider
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editingId ? 'Edit provider' : 'Add provider'}</h2>
            <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Full name *</label>
                <input required value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Jane Smith" className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@email.com" className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="04xx xxx xxx" className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Colour</label>
                <div className="flex items-center gap-2 pt-1">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Skills, availability, notes..."
                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.accept_jobs} onChange={e => setForm(f => ({ ...f, accept_jobs: e.target.checked }))} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Can accept bookings</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                style={{ background: '#2563FF' }}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add provider'}
              </button>
              <button type="button" onClick={resetForm} className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : providers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No providers yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your staff members to start assigning bookings</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map(provider => (
            <div key={provider.id} className={`bg-white rounded-xl border p-5 ${provider.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: provider.color || '#2563FF' }}>
                  {getInitials(provider.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{provider.display_name}</h3>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(provider)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(provider.id, provider.display_name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {provider.email && <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1"><Mail className="w-3 h-3" />{provider.email}</div>}
                  {provider.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5"><Phone className="w-3 h-3" />{provider.phone}</div>}
                  {provider.notes && <p className="text-xs text-gray-400 mt-1.5">{provider.notes}</p>}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleActive(provider.id, provider.is_active)}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${provider.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {provider.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                      {provider.user_id && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Portal access</span>
                      )}
                    </div>
                    {provider.email && !provider.user_id && (
                      <button onClick={() => handleInvite(provider)} disabled={inviting === provider.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all"
                        style={{ borderColor: '#2563FF', color: inviteSuccess === provider.id ? '#16a34a' : '#2563FF', background: inviteSuccess === provider.id ? '#f0fdf4' : 'transparent', borderColor: inviteSuccess === provider.id ? '#16a34a' : '#2563FF' }}>
                        {inviting === provider.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                          : inviteSuccess === provider.id ? <><CheckCircle2 className="w-3 h-3" /> Sent!</>
                          : <><Send className="w-3 h-3" /> Invite to portal</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
