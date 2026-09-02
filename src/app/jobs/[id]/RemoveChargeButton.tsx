'use client'
// Removes a single "Additional charge" child job — for a failed or released
// attempt that's just cluttering the list (and, before the follow-up-charge
// route was made idempotent, a leftover duplicate). Deliberately scoped to
// child jobs only (.not('parent_job_id', 'is', null)) so this can never be
// used to delete a real booking — that's what DeleteBookingButton is for.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RemoveChargeButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (!confirm('Remove this additional charge? This cannot be undone.')) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .not('parent_job_id', 'is', null)
    setLoading(false)
    if (err) { setError(err.message || 'Failed to remove'); return }
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleRemove}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        Remove
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
