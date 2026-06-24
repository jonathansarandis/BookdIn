'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import InlinePriceEditor from '@/components/InlinePriceEditor'

interface Props {
  jobId: string
  initialOverride: number | null  // cents
  derivedTotal: number             // cents — job.total_price ?? job.price ?? 0
  showBorder?: boolean             // add top border when tax breakdown is shown above
}

export default function PriceOverrideEditor({ jobId, initialOverride, derivedTotal, showBorder = false }: Props) {
  const router = useRouter()
  const [override, setOverride] = useState<number | null>(initialOverride)

  // Persist on commit, then refresh the server component so the rest of the
  // page (charge buttons, etc.) re-reads the new amount. Throwing surfaces the
  // error inside InlinePriceEditor.
  async function handleCommit(price_override: number | null) {
    const res = await fetch(`/api/jobs/${jobId}/price-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_override }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Save failed')
    setOverride(price_override)
    router.refresh()
  }

  return (
    <div className={showBorder ? 'border-t border-gray-100 pt-2' : ''}>
      <InlinePriceEditor
        valueCents={override}
        derivedCents={derivedTotal}
        onCommit={handleCommit}
      />
    </div>
  )
}
