'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

type Stage = 'code' | 'password' | 'success'

function ResetVerifyInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [stage, setStage] = useState<Stage>('code')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })
    setLoading(false)

    if (verifyError) {
      setError('That code is invalid or has expired. Request a new one below.')
      return
    }

    setStage('password')
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setStage('success')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-500 rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {stage === 'password' ? 'Set new password' : 'Enter your code'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {stage === 'code' && 'Enter the 6-digit code we emailed you.'}
            {stage === 'password' && 'Choose a new password for your account.'}
            {stage === 'success' && 'BookdIn account recovery'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {stage === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                             placeholder:text-gray-400"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="code">
                  6-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  placeholder="123456"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm tracking-[0.5em] text-center
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                             placeholder:text-gray-400 placeholder:tracking-normal"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                           bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
                           rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Verifying…' : 'Verify code'}
              </button>

              <p className="text-center text-xs text-gray-500">
                Didn&apos;t get a code?{' '}
                <Link href="/auth/forgot-password" className="text-brand-600 font-medium hover:underline">
                  Send a new one
                </Link>
              </p>
            </form>
          )}

          {stage === 'password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                             placeholder:text-gray-400"
                  disabled={loading}
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="confirm-password">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                             placeholder:text-gray-400"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                           bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
                           rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          )}

          {stage === 'success' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Password updated. Redirecting to your dashboard…
            </div>
          )}
        </div>

        {stage !== 'success' && (
          <p className="text-center text-sm text-gray-500 mt-4">
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function ResetVerifyPage() {
  return (
    <Suspense>
      <ResetVerifyInner />
    </Suspense>
  )
}
