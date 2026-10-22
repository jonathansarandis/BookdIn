// @ts-nocheck
'use client'
// Edit an existing invoice: line items, dates, billing address, notes. Totals are recomputed
// with the business's tax settings and written back; the PDF uses the saved line items.
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'

interface LineItem { description: string; quantity: string; unit_price: string }
const toInput = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '')

export default function EditInvoicePage() {
  const router = useRouter()
  const { id } = useParams() as { id: string }
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [form, setForm] = useState({ issue_date: '', due_date: '', billing_address: '', notes: '' })
  const [customerName, setCustomerName] = useState('')
  const [tax, setTax] = useState({ rate: 0, name: 'Tax', show: false, mode: 'exclusive' as 'exclusive' | 'inclusive' })

  useEffect(() => {
    async function load() {
      const supabase: any = createClient()
      const { data: inv } = await supabase.from('invoices').select('*, customer:customers(full_name), job:jobs!invoices_job_id_fkey(job_extras(name, price, quantity), service:services(name))').eq('id', id).single()
      if (!inv) { setErrorMsg('Invoice not found'); return }
      const { data: biz } = await supabase.from('businesses').select('tax_rate, tax_name, show_tax, tax_mode').eq('id', inv.business_id).single()
      if (biz) setTax({ rate: biz.tax_rate ?? 0, name: biz.tax_name?.trim() || 'Tax', show: biz.show_tax ?? false, mode: biz.tax_mode ?? 'exclusive' })
      setCustomerName(inv.customer?.full_name || '')
      setForm({ issue_date: toInput(inv.created_at), due_date: toInput(inv.due_date), billing_address: inv.billing_address || '', notes: inv.notes || '' })
      let lines: LineItem[] = []
      if (Array.isArray(inv.line_items) && inv.line_items.length) {
        lines = inv.line_items.map((li: any) => ({ description: li.description || '', quantity: '1', unit_price: ((li.amountCents || 0) / 100).toFixed(2) }))
      } else if (inv.job) {
        const extras = (inv.job.job_extras || []).filter((e: any) => (e.price || 0) > 0)
        const extrasTotal = extras.reduce((sum: number, e: any) => sum + e.price * (e.quantity || 1), 0)
        lines = [{ description: inv.job.service?.name || 'Service', quantity: '1', unit_price: (((inv.subtotal || 0) - extrasTotal) / 100).toFixed(2) },
          ...extras.map((e: any) => ({ description: e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name, quantity: '1', unit_price: ((e.price * (e.quantity || 1)) / 100).toFixed(2) }))]
      } else {
        lines = [{ description: inv.notes || 'Services rendered', quantity: '1', unit_price: ((inv.subtotal || 0) / 100).toFixed(2) }]
      }
      setItems(lines.length ? lines : [{ description: '', quantity: '1', unit_price: '' }])
      setReady(true)
    }
    load()
  }, [id])

  const update = (i: number, field: string, v: string) => setItems(its => its.map((it, idx) => idx === i ? { ...it, [field]: v } : it))
  const lineTotal = items.reduce((sum, it) => sum + (parseFloat(it.quantity || '0') * parseFloat(it.unit_price || '0')), 0)
  const lineTc = Math.round(lineTotal * 100)
  const showBreakdown = tax.rate > 0 && tax.show
  const taxCents = showBreakdown ? (tax.mode === 'exclusive' ? Math.round(lineTc * tax.rate / 100) : Math.round(lineTc * tax.rate / (100 + tax.rate))) : 0
  const subtotalCents = tax.mode === 'exclusive' ? lineTc : lineTc - taxCents
  const totalCents = lineTc + (tax.mode === 'exclusive' ? taxCents : 0)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErrorMsg(null)
    const supabase: any = createClient()
    const line_items = items
      .filter(it => it.description.trim() || parseFloat(it.unit_price || '0') > 0)
      .map(it => {
        const qty = parseFloat(it.quantity || '1') || 1
        const unit = parseFloat(it.unit_price || '0') || 0
        const desc = it.description.trim() || 'Service'
        return { description: qty > 1 ? `${desc} ×${qty}` : desc, amountCents: Math.round(qty * unit * 100) }
      })
    const patch: any = {
      line_items, subtotal: subtotalCents, tax_amount: taxCents, tax_name: showBreakdown ? tax.name : null, total: totalCents,
      due_date: form.due_date ? new Date(form.due_date + 'T12:00:00').toISOString() : null,
      notes: form.notes || null, billing_address: form.billing_address.trim() || null,
    }
    if (form.issue_date) patch.created_at = new Date(form.issue_date + 'T12:00:00').toISOString()
    let { error } = await supabase.from('invoices').update(patch).eq('id', id)
    if (error && /billing_address/.test(error.message || '')) { delete patch.billing_address; ;({ error } = await supabase.from('invoices').update(patch).eq('id', id)) }
    setSaving(false)
    if (error) { setErrorMsg(error.message); return }
    router.push(`/invoices/${id}`)
    router.refresh()
  }

  const cls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
  if (!ready) return <div className="p-8 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {errorMsg || 'Loading…'}</div>

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4 text-gray-500" /></button>
        <h2 className="text-lg font-semibold text-gray-900">Edit invoice{customerName ? ` — ${customerName}` : ''}</h2>
      </div>
      <form onSubmit={save} className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Billing address</label>
            <textarea rows={2} value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} className={cls + ' resize-none'} placeholder={'Street address\nSuburb STATE Postcode'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Issued date</label><input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className={cls} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Due date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={cls} /></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Line items</h3>
            <button type="button" onClick={() => setItems(i => [...i, { description: '', quantity: '1', unit_price: '' }])} className="flex items-center gap-1.5 text-xs text-brand-600 font-medium"><Plus className="w-3.5 h-3.5" /> Add item</button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6"><input value={it.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Description" className={cls} /></div>
              <div className="col-span-2"><input type="number" min="1" value={it.quantity} onChange={e => update(i, 'quantity', e.target.value)} className={cls + ' text-center'} /></div>
              <div className="col-span-3 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span><input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => update(i, 'unit_price', e.target.value)} className={cls + ' pl-7'} /></div>
              <div className="col-span-1 flex justify-center">{items.length > 1 && <button type="button" onClick={() => setItems(its => its.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}</div>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 space-y-2 text-sm">
            {showBreakdown && (<>
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{tax.name} ({tax.rate}%)</span><span>${(taxCents / 100).toFixed(2)}</span></div>
            </>)}
            <div className="flex justify-between items-center"><span className="font-semibold text-gray-900">Total</span><span className="text-lg font-semibold text-brand-600">${(totalCents / 100).toFixed(2)}</span></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
          <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={cls + ' resize-none'} />
        </div>

        {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
