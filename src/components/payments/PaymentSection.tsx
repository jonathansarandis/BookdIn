// @ts-nocheck
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Banknote, Lock } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

  // Pass the function up to parent on mount
  useState(() => { onReady(getPaymentMethod) })

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

interface PaymentSectionProps {
  paymentMethod: 'card' | 'other'
  onPaymentMethodChange: (method: 'card' | 'other') => void
  onCardReady: (fn: () => Promise<string | null>) => void
}

export default function PaymentSection({ paymentMethod, onPaymentMethodChange, onCardReady }: PaymentSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Payment</h3>
      </div>

      <div className="flex gap-3">
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
          Credit card
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
