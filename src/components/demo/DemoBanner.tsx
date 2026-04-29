// @ts-nocheck
'use client'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function DemoBanner() {
  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #1e3a8a, #2563FF)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0.6rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Zap style={{ width: 14, height: 14, color: '#93c5fd', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8rem', color: '#e0f2fe', fontWeight: 500 }}>
          You're exploring a <strong style={{ color: '#fff' }}>live demo</strong> — data is not real and changes won't be saved.
        </span>
      </div>
      <Link
        href="/api/demo/logout"
        style={{
          background: '#fff',
          color: '#1d4ed8',
          padding: '0.3rem 1rem',
          borderRadius: 6,
          fontSize: '0.78rem',
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Start free trial →
      </Link>
    </div>
  )
}
