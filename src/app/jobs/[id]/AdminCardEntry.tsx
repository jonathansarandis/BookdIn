'use client'
// Lets an admin key in a customer's card themselves (e.g. read out over the phone) and
// save it on file — without forcing an immediate charge, which "Collect payment" always
// does. Reuses the exact same token + SetupIntent flow as the customer-facing secure card
// page (src/app/secure-card/[token]/page.tsx) via the same three endpoints:
// /api/jobs/[id]/setup-link (mint/reuse a token), /api/secure-card/validate (booking info),
// /api/secure-card/create-intent + /api/secure-card/save (the actual card save). The card
// itself is tokenised directly by Stripe's Elements iframe — the raw number never touches
// our server, the same as if the customer had typed it in themselves.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Loader2, X, ShieldCheck } from 'lucide-react'

function ManualCardForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: submitError } = await elements.submit()
      if (submitError) throw new Error(submitError.message)

      const intRes = await fetch('/api/secure-card/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!intRes.ok) {
        const d = await intRes.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to initialise card entry')
      }
      const { clientSecret } = await intRes.json()

      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })
      if (confirmError) throw new Error(confirmError.message || 'Card verification failed')
      if (setupIntent?.status !== 'succeeded') {
        throw new Error('Card could not be verified — double-check the details and try again.')
      }

      const pmId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id

      const saveRes = await fetch('/api/secure-card/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentMethodId: pmId }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save card')

      onSaved()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Saving card...' : 'Save card on file'}
      </button>
      <p className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Tokenised directly by Stripe — the card number never touches our server.
      </p>
    </form>
  )
}

export default function AdminCardEntry({ jobId, hasCard = false }: { jobId: string; hasCard?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<any>(null)
  const [elementsOptions, setElementsOptions] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)

  async function openModal() {
    setLoading(true)
    setError(null)
    try {
      const linkRes = await fetch(`/api/jobs/${jobId}/setup-link`, { method: 'POST' })
      const linkData = await linkRes.json()
      if (!linkRes.ok) throw new Error(linkData.error || 'Failed to prepare card entry')

      const infoRes = await fetch(`/api/secure-card/validate?token=${encodeURIComponent(linkData.token)}`)
      if (!infoRes.ok) throw new Error('Failed to load booking details')
      const info = await infoRes.json()

      const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      const opts = info.stripeAccountId ? { stripeAccount: info.stripeAccountId } : undefined
      setStripePromise(loadStripe(pubKey, opts))
      setElementsOptions({
        mode: 'setup',
        currency: (info.currency || 'aud').toLowerCase(),
        paymentMethodCreation: 'manual',
        paymentMethodTypes: ['card'],
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#2563FF', borderRadius: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' },
        },
      })
      setToken(linkData.token)
      setOpen(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSaved() {
    setOpen(false)
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={openModal}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <CreditCard className="w-3.5 h-3.5" />
        {loading ? 'Preparing...' : hasCard ? 'Replace card manually' : 'Enter card manually'}
      </button>
      {!hasCard && !loading && (
        <p className="text-xs text-gray-500 mt-1 text-center">For when the customer reads their card out over the phone</p>
      )}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

      {open && token && stripePromise && elementsOptions && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Enter card details</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Read the details back to the customer before submitting. This saves the card on file — it does not charge them anything yet.
            </p>
            <Elements stripe={stripePromise} options={elementsOptions}>
              <ManualCardForm token={token} onSaved={handleSaved} />
            </Elements>
          </div>
        </div>
      )}
    </div>
  )
}
