'use client'
// Lets staff correct the amount of an unpaid "Additional charge" (e.g. strip GST
// when the customer switches to cash). Only used on charges that aren't
// authorized/paid, so no Stripe intent needs adjusting.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function EditChargeAmount({ jobId, totalPrice }: { jobId: string; totalPrice: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState((totalPrice / 100).toFixed(2))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const n = parseFloat(value)
    if (isNaN(n) || n <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('jobs')
      .update({ total_price: Math.round(n * 100), tax_amount: 0 })
      .eq('id', jobId)
      .not('parent_job_id', 'is', null)
    setLoading(false)
    if (err) { setError(err.message || 'Failed to save'); return }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1">
        <Pencil className="w-3 h-3" /> Edit price
      </button>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
          <input type="number" min="0.01" step="0.01" value={value} onChange={e => setValue(e.target.value)}
            className="w-full pl-6 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <button onClick={() => setOpen(false)} disabled={loading} className="text-xs text-gray-500 px-2 py-1.5">Cancel</button>
        <button onClick={save} disabled={loading} className="text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-50">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />} Save
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
