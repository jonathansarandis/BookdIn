// @ts-nocheck
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ProviderLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/provider/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '32px', color: '#F0F2FF', letterSpacing: '-1px' }}>
            Bookd<span style={{ color: '#2563FF' }}>In</span>
          </div>
          <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '14px', marginTop: '8px' }}>Provider Portal</p>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '16px', padding: '32px' }}>
          <h1 style={{ color: '#F0F2FF', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Sign in</h1>
          <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '13px', marginBottom: '24px' }}>Access your jobs and schedule</p>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(200,212,240,0.6)', marginBottom: '6px' }}>Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '8px', padding: '10px 12px', color: '#F0F2FF', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(200,212,240,0.6)', marginBottom: '6px' }}>Password</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '8px', padding: '10px 12px', color: '#F0F2FF', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', background: '#2563FF', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
            >
              {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(200,212,240,0.3)', fontSize: '12px', marginTop: '24px' }}>
          Powered by BookdIn
        </p>
      </div>
    </div>
  )
}
