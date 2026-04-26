// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, ExternalLink, Loader2 } from 'lucide-react'

const STEPS = [
  { id: 'profile',   title: 'Business profile',     sub: 'Name, timezone, currency' },
  { id: 'service',   title: 'Add your first service', sub: 'Pricing and duration' },
  { id: 'stripe',    title: 'Connect Stripe',        sub: 'Accept online payments' },
  { id: 'provider',  title: 'Invite a provider',     sub: 'Add staff or contractors' },
  { id: 'launch',    title: 'Share booking link',    sub: 'Get your first booking' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [completed, setCompleted] = useState<string[]>(['profile'])
  const [active, setActive] = useState('service')
  const [loading, setLoading] = useState(false)

  function markDone(id: string) {
    setCompleted(c => [...new Set([...c, id])])
    const idx = STEPS.findIndex(s => s.id === id)
    if (idx < STEPS.length - 1) setActive(STEPS[idx + 1].id)
  }

  async function finish() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', (await supabase.auth.getUser()).data.user!.id)
    router.push('/dashboard')
  }

  const progress = Math.round((completed.length / STEPS.length) * 100)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-500 rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Let&apos;s get you set up 🎉</h1>
          <p className="text-sm text-gray-500 mt-1">Complete these steps to launch your booking system</p>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full mb-2 overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-500 text-right mb-6">{completed.length} of {STEPS.length} complete</p>

        <div className="space-y-2">
          {STEPS.map((step) => {
            const done = completed.includes(step.id)
            const isActive = active === step.id && !done

            return (
              <div key={step.id}
                onClick={() => !done && setActive(step.id)}
                className={`flex items-center gap-4 p-4 bg-white rounded-xl border transition-all cursor-pointer
                  ${isActive ? 'border-brand-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'}
                  ${done ? 'opacity-70' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${done ? 'bg-brand-500' : isActive ? 'border-2 border-brand-500' : 'border-2 border-gray-300'}`}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <span className={`text-xs font-semibold ${isActive ? 'text-brand-500' : 'text-gray-400'}`}>
                        {STEPS.indexOf(step) + 1}
                      </span>
                  }
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.sub}</div>
                </div>
                {done && <span className="text-xs text-brand-600 font-medium">Done ✓</span>}
                {isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); markDone(step.id) }}
                    className="text-xs px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium">
                    {step.id === 'stripe' ? 'Connect →' : step.id === 'launch' ? 'Copy link' : 'Complete →'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Booking link preview */}
        <div className="mt-6 p-4 bg-brand-50 border border-brand-200 rounded-xl">
          <p className="text-xs font-medium text-brand-700 mb-1">Your booking link is ready</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-brand-800 bg-brand-100 px-2 py-1 rounded font-mono flex-1 truncate">
              your-business.cleanly.app/book
            </code>
            <button className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
              <ExternalLink className="w-3 h-3" /> Preview
            </button>
          </div>
        </div>

        <button onClick={finish} disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {completed.length === STEPS.length ? 'Go to dashboard →' : 'Skip for now — go to dashboard'}
        </button>
      </div>
    </div>
  )
}
