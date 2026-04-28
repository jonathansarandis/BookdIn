// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomePageContent from '@/components/marketing/HomePageContent'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <HomePageContent />
}
