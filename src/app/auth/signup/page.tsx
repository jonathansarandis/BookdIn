// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2 } from 'lucide-react'

const INDUSTRIES = [
  { value: 'residential_cleaning', label: '🏠 Residential Cleaning' },
  { value: 'commercial_cleaning', label: '🏢 Commercial Cleaning' },
  { value: 'lawn_care', label: '🌿 Lawn Care' },
  { value: 'pet_walking', label: '🐕 Pet Walking' },
  { value: 'car_wash', label: '🚗 Mobile Car Wash' },
  { value: 'handyman', label: '🔧 Handyman' },
  { value: 'pool_cleaning', label: '🏊 Pool Cleaning' },
  { value: 'carpet_cleaning', label: '🧹 Carpet Cleaning' },
  { value: 'pressure_washing', label: '💧 Pressure Washing' },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    businessName: '',
    industry: 'residential_cleaning',
  })

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          business_name: form.businessName,
          industry: form.industry,
        },
      },
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message || 'Something went wrong')
      setLoading(false)
      return
    }

    // Profile + business created by Supabase trigger (see SQL schema)
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-500 rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {step === 1 ? 'Create your account' : 'Tell us about your business'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1 ? 'Free to start — no credit card needed' : 'We\'ll set things up for your industry'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-brand-500' : 'bg-gray-200'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-brand-500' : 'bg-gray-200'}`} />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Full name</label>
                  <input
                    type="text" required value={form.fullName}
                    onChange={e => update('fullName', e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                  <input
                    type="email" required value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                  <input
                    type="password" required value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <button type="submit"
                  className="w-full px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Continue →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Business name</label>
                  <input
                    type="text" required value={form.businessName}
                    onChange={e => update('businessName', e.target.value)}
                    placeholder="Sparkle Clean Co."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Industry</label>
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {INDUSTRIES.map(ind => (
                      <button key={ind.value} type="button"
                        onClick={() => update('industry', ind.value)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors
                          ${form.industry === ind.value
                            ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                        {form.industry === ind.value && <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />}
                        {form.industry !== ind.value && <span className="w-4 h-4 flex-shrink-0" />}
                        {ind.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Creating...' : 'Create account'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
