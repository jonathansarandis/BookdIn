// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LeadsDashboard from './LeadsDashboard'

export const metadata = { title: 'Leads — BookdIn' }

export default async function LeadsReportPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single()

  if (!profile?.business_id) redirect('/dashboard')

  return <LeadsDashboard businessId={profile.business_id} />
}
