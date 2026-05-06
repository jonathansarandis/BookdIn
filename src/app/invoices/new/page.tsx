// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'

interface LineItem { description: string; quantity: string; unit_price: string }

export default function NewInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unit_price: '' }])
  const [form, setForm] = useState({ customer_id: '', job_id: '', due_date: '', notes: '' })
  const [taxRate, setTaxRate] = useState(0)
  const [taxName, setTaxName] = useState('Tax')
  const [showTax, setShowTax] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()
      const [{ data: cx }, { data: jbs }, { data: biz }] = await Promise.all([
        supabase.from('customers').select('id, full_name').eq('business_id', profile!.business_id!).order('full_name'),
        supabase.from('jobs').select('id, scheduled_at, price, service:services(name), customer:customers(full_name)').eq('business_id', profile!.business_id!).eq('status', 'completed').is('invoice_id', null).order('scheduled_at', { ascending: false }).limit(20),
        supabase.from('businesses').select('tax_rate, tax_name, show_tax').eq('id', profile!.business_id!).single(),
      ])
      setCustomers(cx || [])
      setJobs(jbs || [])
      if (biz) {
        setTaxRate(biz.tax_rate ?? 0)
        setTaxName(biz.tax_name?.trim() || 'Tax')
        setShowTax(biz.show_tax ?? false)
      }
    }
    load()
  }, [])

  function updateItem(i: number, field: string, value: string) {
    setItems(items => items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  function addItem() { setItems(i => [...i, { description: '', quantity: '1', unit_price: '' }]) }
  function removeItem(i: number) { setItems(items => items.filter((_, idx) => idx !== i)) }

  function handleJobSelect(jobId: string) {
    const job = jobs.find(j => j.id === jobId)
    if (job) {
      setForm(f => ({ ...f, job_id: jobId, customer_id: job.customer?.id || f.customer_id }))
      setItems([{ description: job.service?.name || 'Cleaning service', quantity: '1', unit_price: String(job.price / 100) }])
    }
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity || '0') * parseFloat(item.unit_price || '0'))
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user!.id).single()

    const totalCents = Math.round(subtotal * 100)
    const showTaxBreakdown = taxRate > 0 && showTax
    const taxCents = showTaxBreakdown ? Math.round(totalCents * taxRate / (100 + taxRate)) : 0
    const subtotalCents = totalCents - taxCents

    const { data: invoice, error } = await supabase.from('invoices').insert({
      business_id: profile!.business_id!,
      customer_id: form.customer_id,
      job_id: form.job_id || null,
      status: 'draft',
      subtotal: subtotalCents,
      tax_amount: taxCents,
      tax_name: showTaxBreakdown ? taxName : null,
      total: totalCents,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      notes: form.notes || null,
    }).select().single()

    if (!error && invoice && form.job_id) {
      await supabase.from('jobs').update({ invoice_id: invoice.id }).eq('id', form.job_id)
    }

    setLoading(false)
    if (!error) router.push('/invoices')
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">New invoice</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Invoice details</h3>

          {jobs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Link to completed job (optional)</label>
              <select value={form.job_id} onChange={e => handleJobSelect(e.target.value)} className={inputClass}>
                <option value="">Select a job...</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.customer?.full_name} — {j.service?.name} — ${(j.price/100).toFixed(2)} — {new Date(j.scheduled_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Customer *</label>
            <select required value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className={inputClass}>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Due date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Line items</h3>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs text-brand-600 font-medium hover:text-brand-700">
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-1">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-3">Unit price</div>
            <div className="col-span-1"></div>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">
                <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                  placeholder="Description" className={inputClass} />
              </div>
              <div className="col-span-2">
                <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                  className={inputClass + ' text-center'} />
              </div>
              <div className="col-span-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={item.unit_price}
                  onChange={e => updateItem(i, 'unit_price', e.target.value)}
                  placeholder="0.00" className={inputClass + ' pl-7'} />
              </div>
              <div className="col-span-1 flex justify-center">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            {(taxRate > 0 && showTax) && (() => {
              const tc = Math.round(subtotal * 100)
              const tx = Math.round(tc * taxRate / (100 + taxRate))
              return (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900">${((tc - tx) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{taxName} ({taxRate}%)</span>
                    <span className="text-gray-900">${(tx / 100).toFixed(2)}</span>
                  </div>
                </>
              )
            })()}
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-lg font-semibold text-brand-600">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3} placeholder="Payment instructions, thank you note..."
            className={inputClass + ' resize-none'} />
        </div>

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading || !form.customer_id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
