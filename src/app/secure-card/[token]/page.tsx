// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingInfo {
  jobId: string
  customerName: string
  customerEmail: string
  total: number
  businessName: string
  brandColor: string
  contactEmail: string | null
  currency: string
  stripeAccountId: string | null
  serviceName: string
  scheduledAt: string
  isFlexibleTime: boolean
}

// ─── Inner form (must be inside <Elements>) ───────────────────────────────────

function CardForm({ token, info }: { token: string; info: BookingInfo }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const brand = info.brandColor

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const cardEl = elements.getElement(CardElement)
    if (!cardEl) { setSubmitting(false); return }

    const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardEl,
      billing_details: {
        name: info.customerName,
        email: info.customerEmail,
      },
    })

    if (pmError) {
      setError(pmError.message || 'Card error')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/secure-card/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentMethodId: paymentMethod.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save card')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    }

    setSubmitting(false)
  }

  const formattedDate = info.isFlexibleTime
    ? 'Flexible — we'll confirm the exact time closer to your booking'
    : new Date(info.scheduledAt).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })

  const formattedTotal = `$${(info.total / 100).toFixed(2)} ${info.currency}`

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Card saved!</h2>
        <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
          We'll charge <strong>{formattedTotal}</strong> one day before your service on {' '}
          {info.isFlexibleTime ? 'your confirmed service date' : formattedDate}.
          You'll receive a receipt by email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Booking summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Service</span>
          <span className="font-medium text-gray-900">{info.serviceName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span className="font-medium text-gray-900 text-right max-w-[55%]">{formattedDate}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-semibold text-gray-900">{formattedTotal}</span>
        </div>
      </div>

      {/* Card element */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Card details</label>
        <div className="border border-gray-300 rounded-lg px-3 py-3 bg-white focus-within:ring-2 focus-within:ring-offset-0"
          style={{ '--tw-ring-color': brand } as React.CSSProperties}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '14px',
                  color: '#111827',
                  fontFamily: "'DM Sans', sans-serif",
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe}
        className="w-full py-3 text-white text-sm font-medium rounded-lg transition-all hover:brightness-90 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: brand }}
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? 'Saving...' : 'Save card securely →'}
      </button>

      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Secured by Stripe. We never store your card number.
      </p>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecureCardPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<BookingInfo | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)

  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/secure-card/validate?token=${encodeURIComponent(token)}`)
        if (!res.ok) { setInvalid(true); setLoading(false); return }
        const data: BookingInfo = await res.json()
        setInfo(data)

        // Load Stripe with connected account if present
        const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
        const opts = data.stripeAccountId ? { stripeAccount: data.stripeAccountId } : undefined
        setStripePromise(loadStripe(pubKey, opts))
      } catch {
        setInvalid(true)
      }
      setLoading(false)
    }
    validate()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (invalid || !info || !stripePromise) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Link expired or already used</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            This secure link has expired or your card has already been saved.
            {info?.contactEmail && (
              <> If you need help, contact us at{' '}
                <a href={`mailto:${info.contactEmail}`} className="text-blue-600 underline">
                  {info.contactEmail}
                </a>.
              </>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: info.brandColor }}
          >
            <span className="text-white font-semibold text-sm">
              {info.businessName?.charAt(0) ?? ''}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{info.businessName}</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Secure card details</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Hi {info.customerName?.split(' ')[0]}, please save your card to secure your booking.
            Your card won't be charged until the day before your service.
          </p>

          <Elements stripe={stripePromise}>
            <CardForm token={token} info={info} />
          </Elements>
        </div>
      </div>
    </div>
  )
}
