// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function ProviderAcceptPage() {
  const [status, setStatus] = useState<'loading' | 'setup' | 'done' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function handleAccept() {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        setStatus('error')
        setMessage('Invalid or expired invite link.')
        return
      }

      // Check if provider record needs linking
      const providerId = user.user_metadata?.provider_id

      if (providerId) {
        // Link this auth user to the provider record
        const { error: updateError } = await supabase
          .from('providers')
          .update({ user_id: user.id, invite_accepted_at: new Date().toISOString() })
          .eq('id', providerId)

        if (updateError) {
          setStatus('error')
          setMessage('Failed to link account. Please contact support.')
          return
        }
      }

      setStatus('setup')
    }

    handleAccept()
  }, [])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Passwords do not match')
      return
    }
    setSaving(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/provider/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0F1E' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div style={{ fontFamily: "'NeueKabel', 'Arial Black', sans-serif", fontWeight: 900, fontSize: '32px', color: '#F0F2FF', letterSpacing: '-1px' }}>
            Bookd<span style={{ color: '#2563FF' }}>In</span>
          </div>
          <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '14px', marginTop: '8px' }}>Provider Portal</p>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '16px', padding: '32px' }}>
          {status === 'loading' && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#2563FF' }} />
              <p style={{ color: 'rgba(200,212,240,0.6)', fontSize: '14px' }}>Setting up your account...</p>
            </div>
          )}

          {status === 'setup' && (
            <>
              <h1 style={{ color: '#F0F2FF', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Set your password</h1>
              <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '13px', marginBottom: '24px' }}>Choose a password to access your provider portal</p>

              {message && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{message}</p>}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(200,212,240,0.6)', marginBottom: '6px' }}>New password</label>
                  <input
                    type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '8px', padding: '10px 12px', color: '#F0F2FF', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(200,212,240,0.6)', marginBottom: '6px' }}>Confirm password</label>
                  <input
                    type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(37,99,255,0.2)', borderRadius: '8px', padding: '10px 12px', color: '#F0F2FF', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <button
                  type="submit" disabled={saving}
                  style={{ width: '100%', background: '#2563FF', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
                >
                  {saving && <Loader2 style={{ width: '16px', height: '16px' }} />}
                  {saving ? 'Setting up...' : 'Access my portal'}
                </button>
              </form>
            </>
          )}

          {status === 'done' && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#16a34a' }} />
              <p style={{ color: '#F0F2FF', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>All set!</p>
              <p style={{ color: 'rgba(200,212,240,0.5)', fontSize: '13px' }}>Redirecting to your dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <p style={{ color: '#f87171', fontSize: '14px' }}>{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
