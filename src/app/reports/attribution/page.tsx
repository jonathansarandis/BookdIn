// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AttributionDashboard from './AttributionDashboard'

export const metadata = { title: 'Attribution — BookdIn' }

export default async function AttributionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) redirect('/dashboard')

  return <AttributionDashboard businessId={profile.business_id} />
}
