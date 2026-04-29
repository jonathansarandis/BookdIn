// @ts-nocheck
'use client'
import { useSearchParams } from 'next/navigation'
import DemoBanner from '@/components/demo/DemoBanner'
import DemoModal from '@/components/demo/DemoModal'

export default function DemoWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true' ||
    (typeof window !== 'undefined' && window.location.search.includes('demo=true'))

  // Persist demo state in sessionStorage
  if (typeof window !== 'undefined') {
    if (isDemo) sessionStorage.setItem('bookdin-demo', 'true')
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
