'use client'
// Card picker for a booking: lists every card the customer has on file and lets
// staff attach any of them (or switch the one already attached). Attaching only
// records the card (payment_status='card_on_file') — nothing is authorized/charged.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react'

interface Card { id: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; isDefault: boolean }

interface Props {
  jobId: string
  customerId: string
  currentPaymentMethodId: string | null
  // Fallback shown if the live Stripe lookup fails (the single card we have stored).
  fallback?: { paymentMethodId: string; brand: string | null; last4: string | null } | null
}

const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Card')

export default function UseSavedCardButton({ jobId, customerId, currentPaymentMethodId, fallback }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/customers/${customerId}/cards`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        let list: Card[] = d.cards || []
        if (list.length === 0 && fallback) {
          list = [{ id: fallback.paymentMethodId, brand: fallback.brand, last4: fallback.last4, expMonth: null, expYear: null, isDefault: true }]
        }
        setCards(list)
      })
      .catch(() => {
        if (cancelled) return
        setCards(fallback ? [{ id: fallback.paymentMethodId, brand: fallback.brand, last4: fallback.last4, expMonth: null, expYear: null, isDefault: true }] : [])
      })
    return () => { cancelled = true }
  }, [customerId, fallback?.paymentMethodId])

  async function attach(paymentMethodId: string) {
    setBusyId(paymentMethodId)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/attach-saved-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not attach card')
      setDone(true)
      setTimeout(() => router.refresh(), 800)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (done) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Card attached to this booking
      </p>
    )
  }

  if (cards === null) {
    return <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading saved cards…</p>
  }

  // Nothing to offer: no cards, or the only card is already the one attached.
  const selectable = cards.filter(c => c.id !== currentPaymentMethodId)
  if (cards.length === 0 || (cards.length === 1 && cards[0].id === currentPaymentMethodId)) return null

  return (
    <div className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
      <p className="text-xs font-medium text-gray-500 px-0.5">
        {currentPaymentMethodId ? 'Switch to another saved card' : cards.length > 1 ? 'Saved cards' : 'Saved card'}
      </p>
      {selectable.map(c => (
        <button
          key={c.id}
          onClick={() => attach(c.id)}
          disabled={!!busyId}
          className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2 min-w-0">
            {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <CreditCard className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{cap(c.brand)} •••• {c.last4}</span>
            {c.isDefault && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">Default</span>}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {c.expMonth && c.expYear ? `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)} · ` : ''}Use
          </span>
        </button>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
