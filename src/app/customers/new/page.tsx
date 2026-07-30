// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setExistingId(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to add customer')
        if (data.existingId) setExistingId(data.existingId)
        return
      }
      router.push(`/customers/${data.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">Add customer</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            {existingId && (
              <Link href={`/customers/${existingId}`} className="block mt-1 font-medium underline">
                View existing customer →
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">First name *</label>
            <input required value={form.first_name} onChange={e => update('first_name', e.target.value)}
              placeholder="Jane" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Last name *</label>
            <input required value={form.last_name} onChange={e => update('last_name', e.target.value)}
              placeholder="Smith" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            placeholder="jane@email.com" className={inputClass} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
          <input value={form.phone} onChange={e => update('phone', e.target.value)}
            placeholder="04xx xxx xxx" className={inputClass} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
            rows={2} placeholder="Optional" className={`${inputClass} resize-none`} />
        </div>

        <div className="flex gap-3 pt-1">
          <Link href="/customers"
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Adding…' : 'Add customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
