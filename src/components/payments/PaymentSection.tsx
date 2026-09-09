// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Banknote, Lock, CheckCircle2 } from 'lucide-react'

// Bug fix (Sep 2026): this used to be a single module-level `loadStripe(...)` call with
// no stripeAccount, which loads Stripe.js scoped to BookdIn's own platform account. Every
// business here is a Stripe Connect connected account, so a PaymentMethod created that
// way lives on the PLATFORM account — but every server-side call that uses it
// (/api/stripe/intent, capture, etc.) passes `{ stripeAccount: business.stripe_account_id }`.
// Stripe rejects that combination with "No such PaymentMethod ... OAuth key or
// Stripe-Account header was used but API request was provided with a platform-owned
// payment method ID" (reported by Reyan on a manual phone booking). The booking still
// went through because job creation happens before the card step, but the card was
// never actually attached.
//
// Fix: load Stripe.js scoped to the business's OWN connected account via the
// `stripeAccount` option, so createPaymentMethod() creates the PaymentMethod directly on
// that account and every later server call agrees with it. Cached per-account (not
// per-render) since loadStripe() returns a promise that should only be created once for
// a given key.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>()
function getStripePromise(stripeAccountId: string | null) {
  const cacheKey = stripeAccountId || '__platform__'
  let cached = stripePromiseCache.get(cacheKey)
  if (!cached) {
    cached = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
    )
    stripePromiseCache.set(cacheKey, cached)
  }
  return cached
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#111827',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
}

function CardForm({ onReady }: { onReady: (fn: () => Promise<string | null>) => void }) {
  const stripe = useStripe()
  const elements = useElements()

  // Expose a function parent can call to get payment method ID
  const getPaymentMethod = async (): Promise<string | null> => {
    if (!stripe || !elements) return null
    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) return null
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
    })
    if (error) throw new Error(error.message)
    return paymentMethod?.id || null
  }

  // Pass the function up to the parent whenever stripe/elements become ready.
  //
  // This used to be `useState(() => { onReady(getPaymentMethod) })` — a
  // useState initializer runs exactly once, on the component's very first
  // render. Stripe.js/Elements load asynchronously, so on that first render
  // `stripe`/`elements` from useStripe()/useElements() are still null almost
  // every time. That first-render closure of getPaymentMethod — permanently
  // capturing stripe: null, elements: null — is what got registered with the
  // parent, and never any later render's fresh closure. So getPaymentMethod()
  // always hit its `if (!stripe || !elements) return null` guard and returned
  // null even with valid card details entered, which the parent then reports
  // as "Please enter valid card details" — after the booking (job row) had
  // already been created, since that happens before this payment step.
  useEffect(() => { onReady(getPaymentMethod) }, [stripe, elements])

  return (
    <div className="space-y-3 mt-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Card number</label>
        <div className="border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
          <CardNumberElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry date</label>
          <div className="border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
            <CardExpiryElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
          <div className="border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
            <CardCvcElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Lock className="w-3 h-3" />
        <span>256-bit SSL encrypted · Powered by Stripe</span>
      </div>
    </div>
  )
}

interface SavedCard {
  stripe_payment_method_id: string
  card_brand?: string | null
  card_last4?: string | null
  card_exp_month?: number | null
  card_exp_year?: number | null
}

interface PaymentSectionProps {
  paymentMethod: 'card' | 'saved' | 'other'
  onPaymentMethodChange: (method: 'card' | 'saved' | 'other') => void
  onCardReady: (fn: () => Promise<string | null>) => void
  savedCard?: SavedCard | null
  // The business's Stripe Connect account ID — see getStripePromise above for why this
  // matters. null/undefined while the business record is still loading is fine (falls
  // back to the platform account momentarily); pass it as soon as it's known.
  stripeAccountId?: string | null
}

export default function PaymentSection({ paymentMethod, onPaymentMethodChange, onCardReady, savedCard, stripeAccountId }: PaymentSectionProps) {
  const stripePromise = useMemo(() => getStripePromise(stripeAccountId ?? null), [stripeAccountId])
  // "Saved card" skips Stripe Elements entirely — the getter just resolves to
  // the customer's stored payment method ID.
  useEffect(() => {
    if (paymentMethod === 'saved' && savedCard) {
      onCardReady(async () => savedCard.stripe_payment_method_id)
    }
  }, [paymentMethod, savedCard])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Payment</h3>
      </div>

      <div className="flex gap-3">
        {savedCard && (
          <button
            type="button"
            onClick={() => onPaymentMethodChange('saved')}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              paymentMethod === 'saved'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              paymentMethod === 'saved' ? 'border-brand-500' : 'border-gray-300'
            }`}>
              {paymentMethod === 'saved' && <div className="w-2 h-2 rounded-full bg-brand-500" />}
            </div>
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {savedCard.card_brand ? `${savedCard.card_brand} •••• ${savedCard.card_last4}` : 'Saved card'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onPaymentMethodChange('card')}
          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            paymentMethod === 'card'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            paymentMethod === 'card' ? 'border-brand-500' : 'border-gray-300'
          }`}>
            {paymentMethod === 'card' && <div className="w-2 h-2 rounded-full bg-brand-500" />}
          </div>
          <CreditCard className="w-4 h-4" />
          {savedCard ? 'New card' : 'Credit card'}
        </button>

        <button
          type="button"
          onClick={() => onPaymentMethodChange('other')}
          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            paymentMethod === 'other'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            paymentMethod === 'other' ? 'border-brand-500' : 'border-gray-300'
          }`}>
            {paymentMethod === 'other' && <div className="w-2 h-2 rounded-full bg-brand-500" />}
          </div>
          <Banknote className="w-4 h-4" />
          Other (cash/invoice)
        </button>
      </div>

      {paymentMethod === 'saved' && savedCard && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span>
            Using the card on file{savedCard.card_last4 ? ` ending in ${savedCard.card_last4}` : ''}
            {savedCard.card_exp_month && savedCard.card_exp_year ? ` (exp ${String(savedCard.card_exp_month).padStart(2, '0')}/${String(savedCard.card_exp_year).slice(-2)})` : ''} — no need to re-enter details.
          </span>
        </div>
      )}

      {paymentMethod === 'card' && (
        <Elements stripe={stripePromise}>
          <CardForm onReady={onCardReady} />
        </Elements>
      )}

      {paymentMethod === 'other' && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          Payment will be collected via cash or invoice after the service.
        </p>
      )}
    </div>
  )
}
