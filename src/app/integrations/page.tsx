// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, ExternalLink, Zap } from 'lucide-react'

export default function IntegrationsPage() {
  const [business, setBusiness] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('profiles').select('business_id').eq('id', user.id).single()
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', profile?.business_id).single()
      setBusiness(biz)
    }
    load()
  }, [])

  const integrations = [
    {
      name: 'Stripe',
      description: 'Accept online payments from your customers. Connect your Stripe account to enable card payments on invoices and bookings.',
      logo: (
        <div className="w-10 h-10 bg-[#635BFF] rounded-lg flex items-center justify-center">
          <svg width="20" height="14" viewBox="0 0 60 25" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a12.08 12.08 0 0 1-4.56.83c-4.43 0-7.26-2.96-7.26-7.67 0-4.3 2.49-7.71 6.54-7.71 4.05 0 6.09 3.41 6.09 7.66 0 .67-.07 1.17-.1 1.97zm-6.07-5.03c-1.25 0-2.07.88-2.25 2.3h4.48c-.19-1.43-.99-2.3-2.23-2.3z"/>
          </svg>
        </div>
      ),
      connected: !!business?.stripe_account_id && business?.stripe_charges_enabled,
      status: business?.stripe_account_id
        ? business?.stripe_charges_enabled ? 'Connected' : 'Pending setup'
        : 'Not connected',
      action: business?.stripe_account_id ? null : '/api/stripe/connect',
      actionLabel: 'Connect Stripe',
      settingsUrl: '/settings',
      category: 'Payments',
    },
    {
      name: 'Resend',
      description: 'Send transactional emails to your customers — booking confirmations, quotes, invoices and follow-ups.',
      logo: (
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">R</span>
        </div>
      ),
      connected: !!process.env.NEXT_PUBLIC_RESEND_CONNECTED,
      status: 'Connected via BookdIn',
      action: null,
      actionLabel: null,
      settingsUrl: null,
      category: 'Email',
    },
    {
      name: 'Google Calendar',
      description: 'Sync your bookings with Google Calendar so your team always knows what\'s scheduled.',
      logo: (
        <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path fill="#4285F4" d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V8h14v11z"/>
            <path fill="#EA4335" d="M7 10h5v5H7z"/>
          </svg>
        </div>
      ),
      connected: false,
      status: 'Coming soon',
      action: null,
      actionLabel: null,
      category: 'Calendar',
      comingSoon: true,
    },
    {
      name: 'Xero',
      description: 'Sync invoices and payments with Xero for seamless accounting and bookkeeping.',
      logo: (
        <div className="w-10 h-10 bg-[#13B5EA] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">X</span>
        </div>
      ),
      connected: false,
      status: 'Coming soon',
      action: null,
      actionLabel: null,
      category: 'Accounting',
      comingSoon: true,
    },
    {
      name: 'Zapier',
      description: 'Connect BookdIn to 5,000+ apps with Zapier automations.',
      logo: (
        <div className="w-10 h-10 bg-[#FF4A00] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">Z</span>
        </div>
      ),
      connected: false,
      status: 'Coming soon',
      action: null,
      actionLabel: null,
      category: 'Automation',
      comingSoon: true,
    },
    {
      name: 'Twilio SMS',
      description: 'Send SMS reminders and notifications to your customers.',
      logo: (
        <div className="w-10 h-10 bg-[#F22F46] rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">T</span>
        </div>
      ),
      connected: false,
      status: 'Coming soon',
      action: null,
      actionLabel: null,
      category: 'SMS',
      comingSoon: true,
    },
  ]

  const categories = [...new Set(integrations.map(i => i.category))]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Connect BookdIn with the tools your business uses</p>
      </div>

      {categories.map(category => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.filter(i => i.category === category).map(integration => (
              <div key={integration.name} className={`bg-white rounded-xl border p-5 ${integration.connected ? 'border-green-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-4">
                  {integration.logo}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
                      {integration.connected && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      {integration.comingSoon && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{integration.description}</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${
                        integration.connected ? 'text-green-600' :
                        integration.comingSoon ? 'text-gray-400' :
                        'text-gray-500'
                      }`}>
                        {integration.status}
                      </span>
                      {integration.action && (
                        <a
                          href={integration.action}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                        >
                          {integration.actionLabel}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {integration.settingsUrl && integration.connected && (
                        <a
                          href={integration.settingsUrl}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Manage →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-900 mb-1">Request an integration</h3>
          <p className="text-xs text-brand-700">Don't see the tool you need? Let us know and we'll prioritise building it.</p>
          <a href="mailto:support@bookdin.com" className="text-xs font-medium text-brand-600 hover:underline mt-2 inline-block">
            Contact support →
          </a>
        </div>
      </div>
    </div>
  )
}
