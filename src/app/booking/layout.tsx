// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, businesses(*)')
    .eq('id', user.id)
    .single()

  const p = profile as any
  const business = Array.isArray(p?.businesses) ? p.businesses[0] : p?.businesses

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar profile={p} business={business} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar profile={p} business={business} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
