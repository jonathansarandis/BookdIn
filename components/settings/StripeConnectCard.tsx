// @ts-nocheck
// components/settings/StripeConnectCard.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ConnectStatus = 'loading' | 'not_connected' | 'connected' | 'restricted'

interface BusinessStripeData {
  stripe_account_id: string | null
  stripe_connected_at: string | null
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
}

export default function StripeConnectCard() {
  const [status, setStatus] = useState<ConnectStatus>('loading')
  const [data, setData] = useState<BusinessStripeData | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Check for redirect params from Stripe OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe_success') === 'true') {
      setFlashMessage({ type: 'success', text: 'Stripe connected successfully!' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('stripe_error')) {
      setFlashMessage({ type: 'error', text: `Connection failed: ${params.get('stripe_error')}` })
      window.history.replaceState({}, '', window.location.pathname)
    }

    fetchStripeStatus()
  }, [])

  async function fetchStripeStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: business } = await supabase
      .from('businesses')
      .select('stripe_account_id, stripe_connected_at, stripe_charges_enabled, stripe_payouts_enabled')
      .eq('owner_id', user.id)
      .single()

    if (!business) return

    setData(business)

    if (!business.stripe_account_id) {
      setStatus('not_connected')
    } else if (business.stripe_charges_enabled && business.stripe_payouts_enabled) {
      setStatus('connected')
    } else {
      setStatus('restricted')
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Stripe? Customers won\'t be able to pay online until you reconnect.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/stripe/disconnect', { method: 'POST' })
      if (res.ok) {
        setStatus('not_connected')
        setData(null)
        setFlashMessage({ type: 'success', text: 'Stripe disconnected.' })
      } else {
        setFlashMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' })
      }
    } catch {
      setFlashMessage({ type: 'error', text: 'Network error. Please try again.' })
    }
    setDisconnecting(false)
  }

  const connectedAt = data?.stripe_connected_at
    ? new Date(data.stripe_connected_at).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Stripe wordmark SVG */}
          <div className="w-10 h-10 rounded-lg bg-[#635BFF] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.43 0-7.26-2.96-7.26-7.67 0-4.3 2.49-7.71 6.54-7.71 4.05 0 6.09 3.41 6.09 7.66 0 .67-.07 1.17-.1 1.97zm-6.07-5.03c-1.25 0-2.07.88-2.25 2.3h4.48c-.19-1.43-.99-2.3-2.23-2.3zm-20.16 5.03h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.43 0-7.26-2.96-7.26-7.67 0-4.3 2.49-7.71 6.54-7.71 4.05 0 6.09 3.41 6.09 7.66 0 .67-.07 1.17-.1 1.97zm-6.07-5.03c-1.25 0-2.07.88-2.25 2.3h4.48c-.19-1.43-.99-2.3-2.23-2.3zM14.56.37l-3.76.8v3.14L7.04 5.2v-.12C7.04 2.22 5.49.72 3.3.72 1.48.72 0 2.13 0 4.4c0 2.45 1.68 3.49 3.3 4.12v.07c-1.44.5-3.3 1.68-3.3 4.28C0 15.6 2.1 17.4 4.9 17.4c2.1 0 3.73-.73 4.64-1.96l.22 1.65h3.37V.37h1.43zm-8.52 10.6c-.71-.34-1.41-.71-1.41-1.59 0-.77.52-1.22 1.41-1.22.77 0 1.3.37 1.63.88v2.6c-.33-.22-.89-.46-1.63-.67zm.22 3.95c-1.07 0-1.77-.6-1.77-1.56 0-.95.74-1.55 1.77-1.55.7 0 1.3.3 1.63.71v1.74c-.33.37-.93.66-1.63.66z" fill="white"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Stripe payments</h3>
            <p className="text-xs text-gray-500 mt-0.5">Accept online payments from your customers</p>
          </div>
        </div>

        {status === 'connected' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
            Connected
          </span>
        )}
        {status === 'restricted' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
            Restricted
          </span>
        )}
        {status === 'not_connected' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
            Not connected
          </span>
        )}
      </div>

      {flashMessage && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${
          flashMessage.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {flashMessage.text}
        </div>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin"></div>
          Loading...
        </div>
      )}

      {status === 'not_connected' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Connect your Stripe account so your customers can pay invoices and bookings online. 
            Funds go directly to your bank — BookdIn never touches your money.
          </p>
          <a
            href="/api/stripe/connect"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#635BFF] hover:bg-[#5851e8] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Connect Stripe account
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      )}

      {(status === 'connected' || status === 'restricted') && data && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Charges</p>
              <div className="flex items-center gap-1.5">
                {data.stripe_charges_enabled ? (
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                )}
                <span className={`text-sm font-medium ${data.stripe_charges_enabled ? 'text-green-700' : 'text-amber-700'}`}>
                  {data.stripe_charges_enabled ? 'Enabled' : 'Pending'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Payouts</p>
              <div className="flex items-center gap-1.5">
                {data.stripe_payouts_enabled ? (
                  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                )}
                <span className={`text-sm font-medium ${data.stripe_payouts_enabled ? 'text-green-700' : 'text-amber-700'}`}>
                  {data.stripe_payouts_enabled ? 'Enabled' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {status === 'restricted' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Your Stripe account needs more information before payments are fully enabled.{' '}
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Complete setup in Stripe →
              </a>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {connectedAt ? `Connected ${connectedAt}` : 'Connected'}
              {data.stripe_account_id && (
                <span className="ml-2 font-mono">{data.stripe_account_id}</span>
              )}
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
