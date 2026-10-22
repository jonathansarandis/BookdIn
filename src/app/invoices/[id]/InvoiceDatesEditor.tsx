'use client'
// Lets staff change an invoice's issued and due dates after creation.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const toInput = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '')
const show = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function InvoiceDatesEditor({ invoiceId, issuedAt, dueDate }: { invoiceId: string; issuedAt: string; dueDate: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState(toInput(issuedAt))
  const [due, setDue] = useState(toInput(dueDate))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true)
    setError(null)
    const supabase: any = createClient()
    const patch: any = { due_date: due ? new Date(due + 'T12:00:00').toISOString() : null }
    if (issued) patch.created_at = new Date(issued + 'T12:00:00').toISOString()
    const { error: err } = await supabase.from('invoices').update(patch).eq('id', invoiceId)
    setLoading(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span className="text-gray-500">Issued date</span><span className="text-gray-900">{show(issuedAt)}</span></div>
        <div className="flex items-center justify-between"><span className="text-gray-500">Due date</span><span className="text-gray-900">{show(dueDate)}</span></div>
        <button onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit dates</button>
      </div>
    )
  }
  const cls = 'w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm'
  return (
    <div className="space-y-2 text-sm">
      <label className="block text-xs text-gray-500">Issued date<input type="date" value={issued} onChange={e => setIssued(e.target.value)} className={cls} /></label>
      <label className="block text-xs text-gray-500">Due date<input type="date" value={due} onChange={e => setDue(e.target.value)} className={cls} /></label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} disabled={loading} className="flex-1 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg">Cancel</button>
        <button onClick={save} disabled={loading} className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}
