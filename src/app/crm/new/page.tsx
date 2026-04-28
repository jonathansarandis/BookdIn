// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2 } from 'lucide-react'

const SOURCES = ['website', 'referral', 'social', 'walk-in', 'phone', 'email', 'other']

export default function NewCRMContactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const defaultStage = searchParams.get('stage') || 'lead'

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    source: '',
    notes: '',
    next_followup_at: '',
    stage: defaultStage,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      if (profile?.business_id) setBusinessId(profile.business_id)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !businessId) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('crm_contacts')
      .insert({
        business_id: businessId,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source || null,
        notes: form.notes.trim() || null,
        stage: form.stage,
        next_followup_at: form.next_followup_at || null,
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    setSaving(false)
    if (error) {
      setError(error.message)
    } else if (data) {
      router.push(`/crm/${data.id}`)
    }
  }

  const inputClass = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/crm" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add contact</h1>
          <p className="text-sm text-gray-500">Add a new lead or contact to your CRM</p>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Contact details</h2>
          <div>
            <label className={labelClass}>Full name *</label>
            <input type="text" required value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className={inputClass} placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={inputClass} placeholder="jane@email.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className={inputClass} placeholder="04xx xxx xxx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className={inputClass}>
                <option value="">Select source...</option>
                {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className={inputClass}>
                <option value="lead">Lead</option>
                <option value="contacted">Contacted</option>
                <option value="quoted">Quoted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Follow up</h2>
          <div>
            <label className={labelClass}>Next follow up date</label>
            <input type="datetime-local" value={form.next_followup_at}
              onChange={e => setForm({ ...form, next_followup_at: e.target.value })}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className={`${inputClass} resize-none`}
              placeholder="Any initial notes about this contact..." />
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <button type="submit" disabled={saving || !form.full_name.trim() || !businessId}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ background: '#2563FF' }}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Adding...' : 'Add contact'}
          </button>
          <Link href="/crm" className="px-5 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
