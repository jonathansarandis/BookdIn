// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Lock } from 'lucide-react'

// Global event system for triggering the demo modal
export function triggerDemoModal() {
  window.dispatchEvent(new CustomEvent('demo-action-blocked'))
}

export default function DemoModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('demo-action-blocked', handler)
    return () => window.removeEventListener('demo-action-blocked', handler)
  }, [])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '2rem',
          maxWidth: 420, width: '100%', position: 'relative',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}
        >
          <X style={{ width: 16, height: 16, color: '#9ca3af' }} />
        </button>

        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(37,99,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1rem',
        }}>
          <Lock style={{ width: 22, height: 22, color: '#2563FF' }} />
        </div>

        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
          This is a demo
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          You're exploring BookdIn in read-only demo mode. Sign up for a free 14-day trial to create bookings, manage customers, and use all features for real.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link
            href="/auth/signup"
            style={{
              flex: 1, background: '#2563FF', color: '#fff',
              padding: '0.75rem', borderRadius: 9,
              textDecoration: 'none', fontWeight: 600, fontSize: '0.92rem',
              textAlign: 'center', display: 'block',
            }}
          >
            Start free trial
          </Link>
          <button
            onClick={() => setOpen(false)}
            style={{
              flex: 1, background: 'transparent', color: '#374151',
              padding: '0.75rem', borderRadius: 9, border: '1px solid #e5e7eb',
              fontWeight: 500, fontSize: '0.92rem', cursor: 'pointer',
            }}
          >
            Keep exploring
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
          No credit card required · 14-day free trial
        </p>
      </div>
    </div>
  )
}
