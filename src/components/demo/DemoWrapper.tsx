// @ts-nocheck
'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import DemoBanner from '@/components/demo/DemoBanner'
import DemoModal from '@/components/demo/DemoModal'

function DemoWrapperInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'

  if (typeof window !== 'undefined' && isDemo) {
    sessionStorage.setItem('bookdin-demo', 'true')
  }

  const demoMode = isDemo ||
    (typeof window !== 'undefined' && sessionStorage.getItem('bookdin-demo') === 'true')

  if (!demoMode) return <>{children}</>

  return (
    <>
      <DemoBanner />
      <DemoModal />
      {children}
    </>
  )
}

export default function DemoWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <DemoWrapperInner>{children}</DemoWrapperInner>
    </Suspense>
  )
}
